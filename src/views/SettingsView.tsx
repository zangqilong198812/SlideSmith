import { useEffect, useState } from 'react';
import { Check, X, Loader2, KeyRound, Trash2, Info, Image as ImageIcon, Upload } from 'lucide-react';
import type { AppConfig, Project, SocialAccount, ModelOption, PostizIntegration } from '../types';
import { ViewHeader } from '../components/ViewHeader';
import { Button } from '../components/Button';
import { testKeys, getModels, uploadFinalSlide, clearFinalSlide } from '../lib/api';
import { PackPicker } from '../components/PackPicker';
import { SlidePreview } from '../components/SlidePreview';
import { setLanguage, useLanguage, useT } from '../i18n';

interface SettingsViewProps {
  config: AppConfig;
  project: Project;
  accounts: SocialAccount[];
  postizIntegrations: PostizIntegration[];
  canDelete: boolean;
  onSave: (patch: {
    keys?: AppConfig['keys'];
    aiBaseUrl?: string;
    postizBaseUrl?: string;
    model?: string;
    pinterestActor?: string;
    name?: string;
    defaults?: Project['defaults'];
    imagePacks?: string[];
  }) => Promise<void>;
  onConfigChange: (config: AppConfig) => void;
  onDeleteProject: () => void;
  onReloadAccounts: () => void;
  onReloadPostizIntegrations: () => void;
}

const POSTBRIDGE_URL = 'https://post-bridge.com?atp=clip-factory';
const POSTIZ_BASE_URL = 'https://api.postiz.com/public/v1';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEEPSEEK_DEFAULT_MODEL = 'deepseek-v4-flash';

const PostBridgeLink = ({ children }: { children: React.ReactNode }) => (
  <a href={POSTBRIDGE_URL} target="_blank" rel="noreferrer" className="text-ink-4 underline hover:text-ink">
    {children}
  </a>
);

const inputClass =
  'w-full h-9 bg-card border border-line rounded-lg px-3 text-[13px] text-ink ' +
  'placeholder:text-ink-6 outline-none transition-colors ' +
  'focus:border-ink-7 focus:ring-2 focus:ring-ink/10';

export function SettingsView({
  config,
  project,
  accounts,
  postizIntegrations,
  canDelete,
  onSave,
  onConfigChange,
  onDeleteProject,
  onReloadAccounts,
  onReloadPostizIntegrations,
}: SettingsViewProps) {
  const language = useLanguage();
  const t = useT();
  const [postbridge, setPostbridge] = useState(config.keys.postbridge);
  const [postiz, setPostiz] = useState(config.keys.postiz || '');
  const [postizBaseUrl, setPostizBaseUrl] = useState(config.postizBaseUrl || POSTIZ_BASE_URL);
  const [openrouter, setOpenrouter] = useState(config.keys.openrouter);
  const [aiBaseUrl, setAiBaseUrl] = useState(config.aiBaseUrl || OPENROUTER_BASE_URL);
  const [apify, setApify] = useState(config.keys.apify);
  const [pinterestActor, setPinterestActor] = useState(config.pinterestActor);
  const [model, setModel] = useState(config.model);
  const [name, setName] = useState(project.name);
  const [mode, setMode] = useState(project.defaults.mode);
  const [selected, setSelected] = useState<number[]>(project.defaults.socialAccountIds);
  const [postizIntegrationId, setPostizIntegrationId] = useState(project.defaults.postizIntegrationId || '');
  const [imagePacks, setImagePacks] = useState<string[]>(project.imagePacks);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [modelFilter, setModelFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [finalSlideBusy, setFinalSlideBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [test, setTest] = useState<{ postbridge: boolean; postiz: boolean; openrouter: boolean; apify: boolean; errors: Record<string, string> } | null>(null);
  const [publishingTab, setPublishingTab] = useState<'postiz' | 'postbridge'>(
    config.keys.postiz || project.defaults.postizIntegrationId ? 'postiz' : 'postbridge'
  );

  // Re-sync editable fields when the active project changes (switching projects).
  useEffect(() => {
    setName(project.name);
    setMode(project.defaults.mode);
    setSelected(project.defaults.socialAccountIds);
    setPostizIntegrationId(project.defaults.postizIntegrationId || '');
    setImagePacks(project.imagePacks);
  }, [project.id, project.name, project.defaults.mode, project.defaults.socialAccountIds, project.defaults.postizIntegrationId, project.imagePacks]);

  useEffect(() => {
    getModels().then(setModels).catch(() => setModels([]));
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      await onSave({
        keys: { postbridge, postiz, openrouter, apify },
        aiBaseUrl,
        postizBaseUrl,
        model,
        pinterestActor,
        name,
        defaults: { socialAccountIds: selected, mode, postizIntegrationId },
        imagePacks,
      });
      onReloadAccounts();
      onReloadPostizIntegrations();
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      await save();
      setTest(await testKeys());
      onReloadAccounts();
    } finally {
      setTesting(false);
    }
  };

  const toggleAccount = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const finalSlideUrls = project.finalSlideImageUrls?.length
    ? project.finalSlideImageUrls
    : (project.finalSlideImageUrl ? [project.finalSlideImageUrl] : []);

  const uploadFinal = async (files: FileList | null) => {
    const selectedFiles = Array.from(files || []);
    if (!selectedFiles.length) return;
    setFinalSlideBusy(true);
    setSaveError(null);
    try {
      const dataUrls = await Promise.all(selectedFiles.map((file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error || new Error('Could not read image.'));
          reader.readAsDataURL(file);
        })
      ));
      onConfigChange(await uploadFinalSlide(project.id, dataUrls));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setFinalSlideBusy(false);
    }
  };

  const clearFinal = async (imageUrl?: string) => {
    setFinalSlideBusy(true);
    setSaveError(null);
    try {
      onConfigChange(await clearFinalSlide(project.id, imageUrl));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setFinalSlideBusy(false);
    }
  };

  const filtered = modelFilter
    ? models.filter(
        (m) =>
          m.id.toLowerCase().includes(modelFilter.toLowerCase()) ||
          m.name.toLowerCase().includes(modelFilter.toLowerCase())
      )
    : models;
  const isDeepSeek = aiBaseUrl.includes('deepseek');
  const availablePostizIntegrations = postizIntegrations.filter((integration) => !integration.disabled);

  return (
    <>
      <ViewHeader
        title={t('Settings', '设置')}
        subtitle={t(
          'Your own API keys, stored locally on this machine — never sent anywhere but the services they belong to.',
          '你的 API Key 会保存在本机，只会发送给对应服务。'
        )}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-8 space-y-8">
          {/* Project */}
          <Section
            title={t('Project', '项目')}
            description={t(
              'A project is one brand/account. Its Brain and default posting accounts are separate — your API keys and model are shared across all projects.',
              '一个项目对应一个品牌/账号。Brain 和默认发布账号按项目区分，API Key 和模型全局共享。'
            )}
          >
            <Field label={t('Project name', '项目名称')}>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </Field>
            {canDelete && (
              <Button
                variant="danger-ghost"
                icon={<Trash2 size={13} />}
                onClick={() => {
                  const ok = window.confirm(
                    t(
                      `Delete "${project.name}"? This will also remove its queue drafts and default final slide.`,
                      `删除“${project.name}”？这个项目的队列草稿和默认最后一页也会一起删除。`
                    )
                  );
                  if (ok) onDeleteProject();
                }}
              >
                {t('Delete this project', '删除这个项目')}
              </Button>
            )}
          </Section>

          <Section
            title={t('Language', '语言')}
            description={t('Choose the interface language for this browser.', '选择当前浏览器里的界面语言。')}
          >
            <Field label={t('Interface language', '界面语言')}>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value === 'en' ? 'en' : 'zh')}
                className={inputClass}
              >
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>
            </Field>
          </Section>

          {/* Publishing */}
          <Section
            title={t('Publishing', '发布')}
            description={t('Configure each publishing service separately. API keys are stored locally in ~/.slidesmith/config.json.', '分别配置每个发布服务。API Key 保存在本机 ~/.slidesmith/config.json。')}
          >
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl border border-line bg-surface">
              <button
                type="button"
                onClick={() => setPublishingTab('postiz')}
                className={`h-10 rounded-lg text-[13px] font-medium transition-colors ${
                  publishingTab === 'postiz' ? 'bg-card border border-line text-ink shadow-sm' : 'text-ink-5 hover:text-ink'
                }`}
              >
                Postiz
              </button>
              <button
                type="button"
                onClick={() => setPublishingTab('postbridge')}
                className={`h-10 rounded-lg text-[13px] font-medium transition-colors ${
                  publishingTab === 'postbridge' ? 'bg-card border border-line text-ink shadow-sm' : 'text-ink-5 hover:text-ink'
                }`}
              >
                Postbridge
              </button>
            </div>

            {publishingTab === 'postiz' ? (
              <div className="space-y-3">
                <Field
                  label={t('Postiz API key', 'Postiz API Key')}
                  hint={t('Used to send rendered slideshows to connected Postiz channels. TikTok uses upload mode; simple platforms like Threads can be scheduled directly.', '用于把渲染好的轮播发送到 Postiz 连接的平台。TikTok 走 upload；Threads 这类简单平台可直接排程。')}
                >
                  <input
                    value={postiz}
                    onChange={(e) => setPostiz(e.target.value)}
                    placeholder="postiz_..."
                    className={`${inputClass} font-mono`}
                  />
                  <TestBadge ok={test?.postiz} error={test?.errors?.postiz} />
                </Field>
                <Field label={t('Postiz Base URL', 'Postiz Base URL')} hint={t('Cloud default is https://api.postiz.com/public/v1. For self-hosted Postiz, use https://your-domain/api/public/v1.', '云端默认 https://api.postiz.com/public/v1。自部署则填 https://你的域名/api/public/v1。')}>
                  <input
                    value={postizBaseUrl}
                    onChange={(e) => setPostizBaseUrl(e.target.value)}
                    placeholder={POSTIZ_BASE_URL}
                    className={`${inputClass} font-mono`}
                  />
                </Field>
                <Field label={t('Default Postiz integration', '默认 Postiz integration')} hint={t('This is the default channel Slidesmith will use when scheduling through Postiz. Refresh it with Test connection after connecting a new channel in Postiz.', '这是 Slidesmith 通过 Postiz 排程时默认使用的平台。在 Postiz 新连接平台后点测试连接刷新。')}>
                  {postizIntegrations.length === 0 ? (
                    <p className="text-[12px] text-ink-5">
                      {t('No Postiz integrations loaded yet. Add your Postiz API key, save/test, then connect a channel in Postiz.', '还没有加载到 Postiz integrations。先填 Postiz API Key 并保存/测试，然后去 Postiz 连接平台。')}
                    </p>
                  ) : availablePostizIntegrations.length === 0 ? (
                    <p className="text-[12px] text-ink-5">
                      {t('Postiz is connected, but every integration is disabled. Enable a channel inside Postiz first.', 'Postiz 已连接，但所有 integration 都不可用。请先在 Postiz 里启用平台。')}
                    </p>
                  ) : (
                    <select
                      value={postizIntegrationId}
                      onChange={(e) => setPostizIntegrationId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">{t('Select a Postiz integration', '选择 Postiz integration')}</option>
                      {availablePostizIntegrations.map((integration) => (
                        <option key={integration.id} value={integration.id}>
                          {integration.providerIdentifier || 'unknown'} · {integration.name || integration.profile || integration.id}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-surface border border-line">
                  <Info size={13} className="text-ink-5 mt-0.5 shrink-0" />
                  <p className="text-[12px] text-ink-4 leading-snug">
                    {t('Postiz scheduling is provider-aware. TikTok keeps upload/manual inbox behavior; Threads and other simple channels use Postiz scheduled publishing.', 'Postiz 排程会按平台处理。TikTok 保持 upload/manual inbox；Threads 等简单平台由 Postiz 定时发布。')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Field
                  label={t('post-bridge API key', 'post-bridge API Key')}
                  hint={<>{t('Handles scheduling, posting & analytics. Get one at', '负责排程、发布和数据统计。去')} <PostBridgeLink>post-bridge.com</PostBridgeLink> {t('get one.', '获取。')}</>}
                >
                  <input
                    value={postbridge}
                    onChange={(e) => setPostbridge(e.target.value)}
                    placeholder="pb_..."
                    className={`${inputClass} font-mono`}
                  />
                  <TestBadge ok={test?.postbridge} error={test?.errors?.postbridge} />
                </Field>

                {accounts.length === 0 ? (
                  <p className="text-[12px] text-ink-5">
                    {t('No connected accounts yet. Add your post-bridge key, hit Test, then connect accounts at', '还没有连接账号。先填 post-bridge Key 并测试，然后去')} <PostBridgeLink>post-bridge.com</PostBridgeLink> {t("connect accounts — they'll appear here.", '连接账号，之后会显示在这里。')}
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {accounts.map((a) => (
                      <label
                        key={a.id}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-line bg-card cursor-pointer hover:border-line-2"
                      >
                        <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggleAccount(a.id)} />
                        <span className="text-[13px] text-ink font-medium">{a.username}</span>
                        <span className="text-[11px] text-ink-5 uppercase tracking-wide">{a.platform}</span>
                      </label>
                    ))}
                  </div>
                )}

                <Field label={t('Default mode', '默认模式')}>
                  <div className="flex gap-2">
                    <Button variant={mode === 'draft' ? 'primary' : 'secondary'} onClick={() => setMode('draft')}>
                      {t('Save as draft', '保存为草稿')}
                    </Button>
                    <Button variant={mode === 'schedule' ? 'primary' : 'secondary'} onClick={() => setMode('schedule')}>
                      {t('Schedule directly', '直接排程')}
                    </Button>
                  </div>
                </Field>
                <DraftNote />
              </div>
            )}
          </Section>

          {/* AI + tools (global) */}
          <Section
            title={t('AI & tools', 'AI 和工具')}
            description={t('Shared across all projects. Stored locally on this computer.', '所有项目共用，保存在本机。')}
          >
            <Field label={t('AI provider', 'AI 服务商')} hint={t("Use OpenRouter's model catalog, or connect directly to DeepSeek with your DeepSeek key.", '可以用 OpenRouter 模型目录，也可以直接填 DeepSeek Key。')}>
              <div className="flex gap-2">
                <Button
                  variant={aiBaseUrl === DEEPSEEK_BASE_URL ? 'primary' : 'secondary'}
                  onClick={() => {
                    setAiBaseUrl(DEEPSEEK_BASE_URL);
                    setModel((current) => current.startsWith('deepseek-') ? current : DEEPSEEK_DEFAULT_MODEL);
                  }}
                >
                  DeepSeek
                </Button>
                <Button
                  variant={aiBaseUrl === OPENROUTER_BASE_URL ? 'primary' : 'secondary'}
                  onClick={() => {
                    setAiBaseUrl(OPENROUTER_BASE_URL);
                    setModel((current) => current || 'openai/gpt-4o-mini');
                  }}
                >
                  OpenRouter
                </Button>
              </div>
            </Field>
            <Field label={t('AI Base URL', 'AI Base URL')} hint="DeepSeek: https://api.deepseek.com. OpenRouter: https://openrouter.ai/api/v1.">
              <input
                value={aiBaseUrl}
                onChange={(e) => setAiBaseUrl(e.target.value)}
                placeholder={DEEPSEEK_BASE_URL}
                className={`${inputClass} font-mono`}
              />
            </Field>
            <Field label={t('AI API key', 'AI API Key')} hint={t('Runs the AI that writes your slideshows. Paste a DeepSeek key for DeepSeek, or an OpenRouter key for OpenRouter.', '用于生成轮播文案。DeepSeek 就填 DeepSeek Key，OpenRouter 就填 OpenRouter Key。')}>
              <input
                value={openrouter}
                onChange={(e) => setOpenrouter(e.target.value)}
                placeholder={isDeepSeek ? 'sk-...' : 'sk-or-...'}
                className={`${inputClass} font-mono`}
              />
              <TestBadge ok={test?.openrouter} error={test?.errors?.openrouter} />
            </Field>
            <Field label={t('Apify API key (optional)', 'Apify API Key（可选）')} hint={t('Only needed to scrape MORE Pinterest images. The bundled aesthetic packs work without it. Get one at console.apify.com.', '只有抓取更多 Pinterest 图片时才需要；内置素材包不需要。')}>
              <input
                value={apify}
                onChange={(e) => setApify(e.target.value)}
                placeholder="apify_api_..."
                className={`${inputClass} font-mono`}
              />
              <TestBadge ok={test?.apify} error={test?.errors?.apify} />
            </Field>
            <Field label={t('Pinterest Apify actor', 'Pinterest Apify Actor')} hint={t('The Apify actor used for scraping. Change only if you prefer a different one.', '用于抓取 Pinterest 的 Apify actor。一般不用改。')}>
              <input
                value={pinterestActor}
                onChange={(e) => setPinterestActor(e.target.value)}
                placeholder="fatihtahta/pinterest-scraper-search"
                className={`${inputClass} font-mono`}
              />
            </Field>
            <Field
              label={t('Model', '模型')}
              hint={
                isDeepSeek
                  ? t('DeepSeek defaults: deepseek-v4-flash. Use deepseek-v4-pro for higher quality.', 'DeepSeek 默认 deepseek-v4-flash；质量优先可用 deepseek-v4-pro。')
                  : t(`Type a model id, or filter OpenRouter models${models.length ? ` (${models.length} available)` : ''}.`, `输入模型 ID，或筛选 OpenRouter 模型${models.length ? `（${models.length} 个可用）` : ''}。`)
              }
            >
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                list="ai-models"
                placeholder={isDeepSeek ? DEEPSEEK_DEFAULT_MODEL : 'openai/gpt-4o-mini'}
                className={`${inputClass} font-mono mb-2`}
              />
              {!isDeepSeek && (
                <input
                  value={modelFilter}
                  onChange={(e) => setModelFilter(e.target.value)}
                  placeholder="Filter OpenRouter models… e.g. claude, gpt, deepseek"
                  className={inputClass}
                />
              )}
              <datalist id="ai-models">
                {filtered.slice(0, 200).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
                <option value="deepseek-v4-flash">DeepSeek V4 Flash</option>
                <option value="deepseek-v4-pro">DeepSeek V4 Pro</option>
                <option value="deepseek-chat">DeepSeek Chat (legacy)</option>
                <option value="deepseek-reasoner">DeepSeek Reasoner (legacy)</option>
              </datalist>
            </Field>
          </Section>

          {/* Background packs (per project) */}
          <Section
            title={t('Background packs', '背景素材包')}
            description={t('Which image packs new slideshows pull backgrounds from when you hit Generate. Select none to generate with plain gradients.', '生成时从哪些素材包抽背景。全不选则使用纯渐变背景。')}
          >
            <PackPicker selected={imagePacks} onChange={setImagePacks} />
          </Section>

          <Section
            title={t('Default final slides', '默认最后几页')}
            description={t('Appended to every newly generated slideshow in this order. Use these for App Store screenshots, QR codes, or product CTA pages.', '会按顺序自动追加到新生成内容的最后。适合放 App Store 截图、二维码或产品 CTA 页面。')}
          >
            <div className="space-y-3">
              {finalSlideUrls.length ? (
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
                  {finalSlideUrls.map((imageUrl, index) => (
                    <div key={`${imageUrl}-${index}`} className="relative group">
                      <SlidePreview
                        slide={{
                          id: `final-slide-preview-${index}`,
                          text: '',
                          imageUrl,
                          imageFit: 'contain',
                          darkOverlay: false,
                          bgFrom: '#ffffff',
                          bgTo: '#ffffff',
                        }}
                        className="border border-line"
                      />
                      <button
                        type="button"
                        onClick={() => void clearFinal(imageUrl)}
                        disabled={finalSlideBusy}
                        className="absolute right-1 top-1 h-6 w-6 rounded-full bg-black/65 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40"
                        title={t('Remove this final slide', '删除这张默认最后页')}
                      >
                        <X size={13} />
                      </button>
                      <span className="absolute left-1 top-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="aspect-[9/16] w-24 rounded-md border border-dashed border-line-2 bg-raised flex items-center justify-center text-ink-6">
                  <ImageIcon size={20} />
                </div>
              )}
              <div className="space-y-2">
                <p className="text-[12px] text-ink-5 leading-relaxed">
                  {t('New generations will append these exact images at the end. They are rendered without overlay text and preserved with contain fit.', '新生成内容会把这些图片追加到最后。不叠加文字，使用完整显示模式。')}
                </p>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-line text-[12px] text-ink-4 hover:text-ink hover:border-line-2 cursor-pointer">
                    {finalSlideBusy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    {t('Upload images', '上传图片')}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      className="hidden"
                      disabled={finalSlideBusy}
                      onChange={(e) => {
                        void uploadFinal(e.target.files);
                        e.currentTarget.value = '';
                      }}
                    />
                  </label>
                  {finalSlideUrls.length > 0 && (
                    <Button variant="secondary" icon={<Trash2 size={13} />} onClick={() => void clearFinal()} disabled={finalSlideBusy}>
                      {t('Clear all', '全部清除')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Section>

          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="primary"
              size="lg"
              icon={saving ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
              onClick={save}
              disabled={saving}
            >
              {saving ? t('Saving…', '保存中…') : t('Save settings', '保存设置')}
            </Button>
            <Button variant="secondary" size="lg" onClick={runTest} disabled={testing || saving}>
              {testing ? <Loader2 size={13} className="animate-spin" /> : null}
              {t('Test connection', '测试连接')}
            </Button>
            {saved && !saveError && (
              <span className="text-[12px] text-emerald-600 flex items-center gap-1">
                <Check size={13} /> Saved
              </span>
            )}
            {saveError && (
              <span className="text-[12px] text-red-600 flex items-center gap-1">
                <X size={13} /> {saveError}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export function DraftNote() {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-surface border border-line">
      <Info size={13} className="text-ink-5 mt-0.5 shrink-0" />
      <p className="text-[12px] text-ink-4 leading-snug">
        <span className="font-medium text-ink-3">Drafts vs. scheduling:</span> drafts land in your
        post-bridge inbox to post by hand. You won't get analytics back on drafts — TikTok only
        reports on content it publishes itself — but posting manually avoids automation detection,
        so reach potential is often higher. Scheduling posts automatically and does report analytics.
      </p>
    </div>
  );
}

function TestBadge({ ok, error }: { ok?: boolean; error?: string }) {
  if (ok === undefined) return null;
  return ok ? (
    <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
      <Check size={11} /> Connected
    </p>
  ) : (
    <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
      <X size={11} /> {error || 'Failed'}
    </p>
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

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-ink-5 mb-1 block">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-ink-6 mt-1">{hint}</p>}
    </div>
  );
}
