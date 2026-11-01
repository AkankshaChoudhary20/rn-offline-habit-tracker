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

test('invalid stored dates cannot distort streaks or last-completion metadata',()=>{
  const result=api.calculateStreak(records(['2026-03-01','2026-03-02','2026-02-30','not-a-date','2026-3-3','2026-13-01']),'2026-03-02');
  assert.equal(result.currentStreak,2);assert.equal(result.longestStreak,2);assert.equal(result.lastCompletedDate,'2026-03-02');
});
test('only invalid completions produce an empty streak',()=>{
  const result=api.calculateStreak(records(['2026-02-30']),'2026-03-02');
  assert.equal(result.currentStreak,0);assert.equal(result.longestStreak,0);assert.equal(result.lastCompletedDate,null);
});
test('invalid reference dates are rejected before computing empty results',()=>{
  assert.throws(()=>api.calculateStreak([],'2026-02-30'),/valid YYYY-MM-DD/);
});
test('date math does not remap years below 0100 into the twentieth century',()=>{
  assert.equal(api.daysBetween('0099-12-31','0100-01-01'),1);
});
