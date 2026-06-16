import type { BrainState } from '../types';
import { ViewHeader } from '../components/ViewHeader';
import { useT } from '../i18n';

interface BrainViewProps {
  brain: BrainState;
  onChange: (brain: BrainState) => void;
}

const inputClass =
  'w-full h-9 bg-card border border-line rounded-lg px-3 text-[13px] text-ink ' +
  'placeholder:text-ink-6 outline-none transition-colors ' +
  'focus:border-ink-7 focus:ring-2 focus:ring-ink/10';

const textareaClass =
  'w-full bg-card border border-line rounded-lg px-3 py-2.5 text-[13px] text-ink ' +
  'placeholder:text-ink-6 outline-none transition-colors resize-none ' +
  'focus:border-ink-7 focus:ring-2 focus:ring-ink/10';

export function BrainView({ brain, onChange }: BrainViewProps) {
  const t = useT();
  return (
    <>
      <ViewHeader
        title={t('Brain', '账号脑袋')}
        subtitle={t('What the AI knows about this project. Edits apply to all future generations.', 'AI 对这个项目的理解。修改后只影响未来生成。')}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8 space-y-8">
          {/* Niche & app */}
          <Section title={t('Account context', '账号背景')} description={t('Rarely changes. Defines who the AI is writing for.', '通常不用频繁改，用来定义 AI 给谁写内容。')}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('Niche', '赛道')}>
                <input
                  value={brain.niche}
                  onChange={(e) => onChange({ ...brain, niche: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label={t('App name', 'App 名称')}>
                <input
                  value={brain.appName}
                  onChange={(e) => onChange({ ...brain, appName: e.target.value })}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label={t('App description', 'App 描述')}>
              <textarea
                value={brain.appDescription}
                onChange={(e) => onChange({ ...brain, appDescription: e.target.value })}
                rows={2}
                className={textareaClass}
              />
            </Field>
            <Field label={t('Audience', '目标受众')}>
              <input
                value={brain.audience}
                onChange={(e) => onChange({ ...brain, audience: e.target.value })}
                className={inputClass}
              />
            </Field>
          </Section>

          {/* Style memory */}
          <Section
            title={t('Style memory', '风格记忆')}
            description={t('The voice and patterns that work for you. Describe your hooks, slide structure, and CTAs — the AI follows this closely.', '记录适合你的语气、结构、hook 和 CTA，AI 会尽量贴近。')}
          >
            <textarea
              value={brain.styleMemory}
              onChange={(e) => onChange({ ...brain, styleMemory: e.target.value })}
              rows={16}
              className={`${textareaClass} font-mono text-[12px] leading-relaxed`}
            />
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[13px] font-semibold text-ink uppercase tracking-widest">{title}</h2>
        <p className="text-[12px] text-ink-5 mt-1">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-ink-5 mb-1 block">{label}</label>
      {children}
    </div>
  );
}
