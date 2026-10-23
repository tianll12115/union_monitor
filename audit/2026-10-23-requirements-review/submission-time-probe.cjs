const fs=require('fs');const path=require('path');const vm=require('vm');
const root=path.resolve(__dirname,'../..');
const core=require(path.join(root,'web/core.js'));
const app=fs.readFileSync(path.join(root,'web/app.js'),'utf8');
const functions=vm.runInNewContext(app.slice(app.indexOf('function date('),app.indexOf('function link('))+';({submissionText,submissionFields})');
const partial={events:[{kind:'push',source:'operate_logs',time_ms:100}],issues:['操作日志采集失败']};
const result={legacy_future_time:core.submissionValue({events:[{kind:'push',source:'operate_logs',time_ms:9999999999999}]}),
 cutoff_expected:200,zero_row_text:functions.submissionText({submission_time_profile:'ubs-latest-code-submission-v1',latest_submission_ms:0,latest_submission_source:'PR.created_at'}),
 legacy_partial_export:functions.submissionFields(partial),legacy_partial_sort:core.submissionValue(partial)};
fs.writeFileSync(path.join(__dirname,'ecpsg-time-probes.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
