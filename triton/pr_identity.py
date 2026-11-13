"""Resolve PR identities from explicit run evidence or fork/ref/commit evidence."""
import json
from datetime import datetime
from pathlib import Path
from urllib.parse import quote


class AmbiguousPRIdentity(ValueError):
    """More than one PR has evidence for the same run/attempt.

    This is an ordinary unknown outcome (never a source failure), but unlike a
    run with no candidate at all it carries the matched PR numbers. Publishing
    those candidates is not a guess: it tells the reader exactly which PRs the
    run can belong to and why no single owner was chosen.
    """

    def __init__(self, diagnostic):
        self.diagnostic = diagnostic
        self.candidates = sorted(diagnostic.get("matches") or [])
        super().__init__(f"PR identity unresolved/ambiguous: {diagnostic}")


class PRResolver:
    def __init__(self, api, evidence_dir=None):
        self.api=api
        self.evidence_dir=Path(evidence_dir) if evidence_dir else None
        self.cache={}

    def read(self, path, many=False):
        key=(path,many)
        if key not in self.cache:
            self.cache[key]=self.api.pages(path) if many else self.api.get(path)[0]
        return self.cache[key]

    @staticmethod
    def same_source(run, pr):
        head=pr.get("head") or {}
        repo=head.get("repo") or {}
        source=run.get("head_repository") or {}
        if run.get("head_branch") and head.get("ref")!=run["head_branch"]: return False
        if source.get("id") and repo.get("id"): return source["id"]==repo["id"]
        if source.get("full_name") and repo.get("full_name"):
            return source["full_name"].lower()==repo["full_name"].lower()
        return False

    @staticmethod
    def created_before(run, pr):
        """The PR must have existed when the run was created."""
        if not pr.get("created_at") or not run.get("created_at"): return True
        parse=lambda x:datetime.fromisoformat(x.replace("Z","+00:00"))
        return parse(pr["created_at"])<=parse(run["created_at"])

    @staticmethod
    def open_at_run(run, pr):
        """Whether the PR was still open when the run was created."""
        if not run.get("created_at"): return True
        closed=pr.get("closed_at")
        if not closed: return True
        parse=lambda x:datetime.fromisoformat(x.replace("Z","+00:00"))
        return parse(closed)>=parse(run["created_at"])

    @staticmethod
    def existed(run, pr):
        """The PR must have existed *and still been open* when the run started.

        A closed PR cannot win over an open successor, but it is not discarded
        outright: when it is the only PR whose commit matches, the late event
        still belongs to it (see ``resolve``). Ignoring ``closed_at`` entirely
        made every reused branch ambiguous (2026-11-13: a 42-second PR still
        matched runs created two minutes after it closed).
        """
        return PRResolver.created_before(run, pr) and PRResolver.open_at_run(run, pr)

    def compare(self, sha, anchor):
        result=self.read(f"/compare/{sha}...{anchor}?per_page=1")
        if self.evidence_dir:
            self.evidence_dir.mkdir(parents=True,exist_ok=True)
            (self.evidence_dir/f"compare-{sha}-{anchor}.json").write_text(
                json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
        return result

    def historical_head(self, run, number, base_sha=None):
        key=("force_push_history",number)
        if key not in self.cache:
            self.cache[key]=self.api.force_push_history(number)
            if self.evidence_dir:
                self.evidence_dir.mkdir(parents=True,exist_ok=True)
                (self.evidence_dir/f"pr-{number}-force-pushes.json").write_text(
                    json.dumps(self.cache[key],ensure_ascii=False,indent=2),encoding="utf-8")
        if not run.get("created_at"): return None
        parse=lambda x:datetime.fromisoformat(x.replace("Z","+00:00"))
        created=parse(run["created_at"])
        for event in self.cache[key]:
            if not isinstance(event,dict) or not event.get("createdAt"):
                raise RuntimeError(f"PR {number} force-push event incomplete")
            try:
                when=parse(event["createdAt"])
            except (ValueError, TypeError, AttributeError):
                raise RuntimeError(f"PR {number} force-push event timestamp invalid") from None
            for field,valid in (("beforeCommit",created<=when),("afterCommit",when<=created)):
                if valid and (event.get(field) or {}).get("oid")==run.get("head_sha"):
                    return {"matched_field":field,**event}
        # Ordinary pushes between force pushes are not timeline endpoints.
        # Prove membership in a later pre-force-push head's ancestry.
        sha=run.get("head_sha")
        for event in self.cache[key]:
            anchor=(event.get("beforeCommit") or {}).get("oid")
            if not anchor or parse(event["createdAt"]) < created: continue
            comparison=self.compare(sha,anchor)
            if comparison.get("status") not in ("ahead","identical"): continue
            if (comparison.get("merge_base_commit") or {}).get("sha")!=sha: continue
            # Shared upstream ancestry does not prove a PR head; target-event
            # runs can carry the base SHA. Missing proof still blocks publishing.
            if not base_sha: continue
            base=self.compare(sha,base_sha)
            if base.get("status") not in ("behind","diverged"): continue
            return {"matched_field":"beforeCommit.ancestor","matched_sha":sha,**event}
        return None

    def resolve(self, run):
        linked=run.get("pull_requests") or []
        explicit={p["number"]:p for p in linked if p.get("number")}
        candidates=[]
        if explicit:
            candidates=[self.read(f"/pulls/{n}") for n in explicit]
        else:
            source=run.get("head_repository") or {}
            owner=(source.get("owner") or {}).get("login") or source.get("full_name","").split("/")[0]
            if owner and run.get("head_branch"):
                head=quote(owner+":"+run["head_branch"],safe="")
                candidates=self.read(f"/pulls?state=all&head={head}",many=True)
            if not candidates:
                candidates=self.read(f"/commits/{run['head_sha']}/pulls",many=True)
        matches=[]
        for pr in candidates:
            number=pr.get("number")
            if not number or not self.created_before(run,pr): continue
            is_linked=number in explicit
            if not is_linked and not self.same_source(run,pr): continue
            is_open=is_linked or self.open_at_run(run,pr)
            sha=run.get("head_sha")
            snapshot=((explicit.get(number) or {}).get("head") or {}).get("sha")
            if is_linked and snapshot:
                matches.append((pr,snapshot,"run.pull_requests.head.sha",None,is_open));continue
            if sha and sha==(pr.get("head") or {}).get("sha"):
                matches.append((pr,sha,"source_repository+branch+head_sha",None,is_open));continue
            if sha and any(c.get("sha")==sha for c in self.read(f"/pulls/{number}/commits",many=True)):
                matches.append((pr,sha,"source_repository+branch+pr_commit_history",None,is_open));continue
            history=self.historical_head(run,number,(pr.get("base") or {}).get("sha")) if sha else None
            if history:
                method="source_repository+branch+force_push_history"
                if history["matched_field"]=="beforeCommit.ancestor": method+="+ancestry"
                matches.append((pr,sha,method,history,is_open))
        # Never guess from title, nearest creation time, or the first branch
        # match. An open PR always wins over a closed one; a closed PR is only
        # accepted when it is the *only* matching PR (a late event for its
        # commit), and the result is labelled as closed-before-run.
        open_matches={p[0]["number"]:p for p in matches if p[4]}
        closed_matches={p[0]["number"]:p for p in matches if not p[4]}
        if len(open_matches)==1:
            chosen=next(iter(open_matches.values())); closed_before=False
        elif not open_matches and len(closed_matches)==1:
            chosen=next(iter(closed_matches.values())); closed_before=True
        else:
            diagnostic={"run_id":run.get("id"),"head_sha":run.get("head_sha"),"head_branch":run.get("head_branch"),
                        "candidates":[p.get("number") for p in candidates],
                        "matches":sorted(list(open_matches)+list(closed_matches))}
            self.save(run,diagnostic)
            if matches:
                # The run demonstrably gates more than one PR (for example two
                # open PRs sharing one head commit, or several closed ones).
                # Keep every candidate; the caller publishes them instead of
                # inventing a single owner.
                raise AmbiguousPRIdentity(diagnostic)
            raise ValueError(f"PR identity unresolved/ambiguous: {diagnostic}")
        pr,sha,method,history,_=chosen
        if closed_before: method+="+closed_pr"
        result={"pr":pr["number"],"pr_url":pr.get("html_url") or f"https://github.com/triton-lang/triton-ascend/pull/{pr['number']}",
                "pr_title":pr.get("title"),"base_branch":(pr.get("base") or {}).get("ref"),"head_sha":sha,
                "pr_evidence":{"method":method,"run_id":run.get("id"),"pr":pr["number"],"raw_run_sha":run.get("head_sha"),"resolved_head_sha":sha,
                               "source_repository":(pr.get("head",{}).get("repo") or {}).get("full_name"),"head_ref":(pr.get("head") or {}).get("ref")}}
        if closed_before:
            result["pr_evidence"]["pr_closed_before_run"]=True
            result["pr_evidence"]["closed_at"]=pr.get("closed_at")
        if history: result["pr_evidence"]["force_push_event"]=history
        if not result["pr_title"] or not result["base_branch"]:
            raise ValueError(f"PR {pr['number']} metadata incomplete")
        self.save(run,result)
        return result

    def save(self,run,value):
        if self.evidence_dir:
            self.evidence_dir.mkdir(parents=True,exist_ok=True)
            (self.evidence_dir/f"{run['id']}.json").write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding="utf-8")

def association_error_kind(exc):
    """Classify an association failure for honest reporting (UDR-002).

    A ``ValueError`` is an ordinary unknown outcome (no evidence, or ambiguous
    candidates); anything else — a network error, rate limit or other source
    request failure — is a source failure that must never be re-labelled
    ``unknown`` and never become a "verified" association.
    """
    return "unknown" if isinstance(exc, ValueError) else "source_failure"


def recover_identities(runs, resolver):
    """Re-attempt association for runs previously left ``unresolved`` (UDR-002).

    Each run/attempt is updated **in place** (never duplicated), so every
    identity still appears exactly once. Returns a list of recovery records
    that keep the previous unknown state and the new evidence-backed
    association as migration evidence.

    - A run that resolves now is recovered and recorded with ``recovery``
      migration evidence; its previous ``unresolved`` state is preserved in
      that record, not discarded.
    - A run that is still unresolved for lack or ambiguity of evidence stays
      untouched (NOT claimed recovered).
    - A source request failure propagates (raises) instead of being downgraded
      to ``unknown`` or wrapped as a recovered success.
    """
    records = []
    for run in runs:
        evidence = run.get("pr_evidence") or {}
        if evidence.get("method") != "unresolved":
            continue
        previous = {"method": "unresolved", "error": evidence.get("error"),
                    "run_id": run.get("id")}
        try:
            result = resolver.resolve(run)
        except ValueError:
            # Ordinary unknown/ambiguous: keep the run's honest unresolved gap.
            continue
        # Any non-ValueError (source request failure) propagates unchanged.
        for key in ("pr", "pr_url", "pr_title", "base_branch", "head_sha", "pr_evidence"):
            if key in result:
                run[key] = result[key]
        method = (result.get("pr_evidence") or {}).get("method")
        record = {
            "run_id": run.get("id"),
            "attempt": int(run.get("run_attempt") or 1),
            "previous": previous,
            "recovered_method": method,
            "pr": result.get("pr"),
            "head_sha": result.get("head_sha"),
        }
        run["recovery"] = record
        records.append(record)
    return records
