// Analysis is a recorded judgment; collecting bytes never creates one.
export function sourceAnalysisState(analysis,source,toolset){
  if(!source || source.state!=='captured')return 'Source unavailable';
  if(!analysis || analysis.status!=='Code analyzed')return 'Not analyzed';
  if(analysis.sourceHash!==(source.implementationHash || source.sha256))return 'Needs recheck';
  const files=new Map(toolset.files.map(f=>[f.path,f.sha256]));
  if(analysis.dependencies.some(f=>files.get(f.path)!==f.sha256))return 'Needs recheck';
  const paths=toolset.files.filter(f=>analysis.verdict==='No equivalent'||!analysis.tools.length||analysis.tools.some(t=>f.path.startsWith('userscripts/'+t+'/'))||analysis.dependencies.some(d=>d.path===f.path));
  if(paths.some(f=>!analysis.dependencies.some(d=>d.path===f.path)))return 'Needs recheck';
  if((analysis.verdict==='No equivalent'||!analysis.tools.length)&&analysis.suiteInventoryHash!==toolset.inventoryHash)return 'Needs recheck';
  return 'Code analyzed';
}
