export const reviewSteps = [
 ['Review','Filter scripts and expand a row. Compare the maintainer verdict with source findings and linked discussions.'],
 ['Correct','Choose your verdict, adjust capability weights/coverage, and add notes or comments. Drafts save only in this browser; notes alone do not change the verdict.'],
 ['Share','Send to GitHub opens a 3rd party discussion with title, readable changes and export filled in. Attach the downloaded JSON if prompted, then publish. One account can create several discussions.'],
 ['Incorporate','Give the discussion to the AI. It checks the author, report version and major source features, retains hashes, and explains disagreements. The maintainer decides which corrections to accept.'],
 ['Follow up','Accepted changes appear in a new report with contributor and discussion links. Reuse unchanged source checks; revisit changed hashes. Export/Import moves drafts between browsers or report sites.']
];
export const shortcutHelp='Focus a script row: 1–7 chooses a verdict, 0 uses Weighted, N opens its note. Shortcuts are disabled while typing.';
export function reviewHelpMarkdown(){return '## Review process\n\n'+reviewSteps.map(([title,text],i)=>(i+1)+'. **'+title+'.** '+text).join('\n')+'\n\n'+shortcutHelp+'\n';}
export function reviewHelpHtml(){return '<ol>'+reviewSteps.map(([title,text])=>'<li><strong>'+title+'.</strong> '+text+'</li>').join('')+'</ol><p>'+shortcutHelp+'</p>';}
