import { ANALYSIS_TPL1 } from './gen-yuqing-analysis-tpl1.mjs';
import { ANALYSIS_TPL2 } from './gen-yuqing-analysis-tpl2.mjs';
const all = [...ANALYSIS_TPL1, ...ANALYSIS_TPL2];
for (const f of all) {
  const lines = f.content.split('\n');
  const annos = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^@(Data|Getter|Setter|Builder|NoArgsConstructor|AllArgsConstructor|EqualsAndHashCode|Slf4j|Component|Service|Repository|Configuration|ConfigurationProperties)\b/.test(t)) {
      annos.push(t.split('(')[0]);
    }
    if (/^(public\s+)?(final\s+)?(class|interface|enum)\s/.test(t)) {
      annos.push('> ' + t.replace(/\s*\{.*/, ''));
    }
  }
  console.log('==== ' + f.rel + '  [' + [...new Set(annos)].join(' | ') + ']');
}
console.log('\n--- RuleJudger.judge ---');
const rj = ANALYSIS_TPL2.find(x => x.rel.endsWith('RuleJudger.java')).content;
console.log(rj.split('\n').slice(0).filter(l => /judge\(|public static ParsedJudgement/.test(l)).slice(0, 12).join('\n'));
