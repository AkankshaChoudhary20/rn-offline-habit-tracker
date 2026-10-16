const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/utils/streak.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const api={};vm.runInNewContext(compiled,{exports:api});
const records=dates=>dates.map((date,id)=>({id:String(id),date,completed:true,deleted:false}));
test('future-only completions cannot start a current streak',()=>{
  assert.equal(api.calculateStreak(records(['2026-04-06']),'2026-04-05').currentStreak,0);
});
test('future check-ins do not extend or hide the real current streak',()=>{
  for(const future of ['2026-04-06','2026-04-20']){
    const result=api.calculateStreak(records(['2026-04-03','2026-04-04','2026-04-05',future]),'2026-04-05');
    assert.equal(result.currentStreak,3);
  }
});
test('a completed yesterday still preserves the grace day',()=>{
  assert.equal(api.calculateStreak(records(['2026-04-03','2026-04-04','2026-04-20']),'2026-04-05').currentStreak,2);
});
