import { Bot, Headphones, MessageSquare, Sparkles } from 'lucide-react';
import {
  DEFAULT_PORTFOLIO_SETTINGS,
  PORTFOLIO_SETTINGS_CONSTRAINTS,
  type PortfolioSettings,
} from '../utils/ownerGovernance';

type Props = {
  draft: PortfolioSettings;
  setDraft: (updater: (prev: PortfolioSettings) => PortfolioSettings) => void;
  isLight: boolean;
  title?: string;
  description?: string;
};

export default function ChatConfigFields({
  draft,
  setDraft,
  isLight,
  title = 'Chatbot & LLM limits',
  description = 'Ten owner-controlled chat settings: feature toggles, per-visitor caps (default 10 questions), Cursor LLM enrichment, and live-agent handoff.',
}: Props) {
  const rowCard = isLight
    ? 'border-slate-200 bg-slate-50/70'
    : 'border-slate-800/80 bg-[#070b14]';
  const titleCls = isLight ? 'text-slate-900' : 'text-white';
  const mutedCls = isLight ? 'text-slate-500' : 'text-slate-400';
  const inputCls = isLight
    ? 'border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:border-sky-500'
    : 'border-slate-700 bg-[#070b14] text-slate-100 placeholder-slate-500 focus:border-cyan-500';

  const toggles: Array<{
    key:
      | 'enablePortfolioChat'
      | 'enableLiveChat'
      | 'enableChatLlm'
      | 'chatShowSuggestions'
      | 'chatOfferLiveAgent';
    icon: typeof Bot;
    title: string;
    desc: string;
  }> = [
    {
      key: 'enablePortfolioChat',
      icon: MessageSquare,
      title: 'Enable portfolio chatbot',
      desc: 'Shows the visitor chat widget for grounded Q&A.',
    },
    {
      key: 'enableLiveChat',
      icon: Headphones,
      title: 'Enable OTP live chat',
      desc: 'Allows email-verified live sessions with the owner console.',
    },
    {
      key: 'enableChatLlm',
      icon: Sparkles,
      title: 'Enable Cursor LLM enrichment',
      desc: 'Uses Cursor Cloud Agents API when CURSOR_API_KEY is set; otherwise grounded answers.',
    },
    {
      key: 'chatShowSuggestions',
      icon: Bot,
      title: 'Show suggestion chips',
      desc: 'Displays starter questions in the chat widget.',
    },
    {
      key: 'chatOfferLiveAgent',
      icon: Headphones,
      title: 'Offer live-agent handoff',
      desc: 'Suggests live chat when bot confidence is low.',
    },
  ];

  return (
    <div className={`rounded-xl border p-3.5 space-y-3 ${rowCard}`}>
      <div>
        <div className={`text-xs font-semibold flex items-center gap-1.5 ${titleCls}`}>
          <Bot className="w-4 h-4 text-cyan-400" />
          {title}
        </div>
        <p className={`text-[11px] mt-0.5 ${mutedCls}`}>{description}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {toggles.map((item) => {
          const Icon = item.icon;
          return (
            <label
              key={item.key}
              className={`rounded-lg border p-2.5 flex items-start justify-between gap-2 cursor-pointer ${
                isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-[#090d16]'
              }`}
            >
              <div className="flex items-start gap-2 min-w-0">
                <Icon className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className={`text-[11px] font-semibold ${titleCls}`}>{item.title}</div>
                  <div className={`text-[10px] leading-snug mt-0.5 ${mutedCls}`}>{item.desc}</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(draft[item.key])}
                onChange={(e) => setDraft((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500 shrink-0 cursor-pointer"
              />
            </label>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className={`block text-[10px] font-mono uppercase mb-1 ${mutedCls}`}>
            Max questions / visitor (default {DEFAULT_PORTFOLIO_SETTINGS.chatMaxQuestionsPerVisitor})
          </label>
          <input
            type="number"
            min={PORTFOLIO_SETTINGS_CONSTRAINTS.chatMaxQuestionsPerVisitorMin}
            max={PORTFOLIO_SETTINGS_CONSTRAINTS.chatMaxQuestionsPerVisitorMax}
            value={draft.chatMaxQuestionsPerVisitor}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                chatMaxQuestionsPerVisitor: Number(e.target.value),
              }))
            }
            className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none ${inputCls}`}
          />
        </div>
        <div>
          <label className={`block text-[10px] font-mono uppercase mb-1 ${mutedCls}`}>
            Max Cursor LLM answers / visitor
          </label>
          <input
            type="number"
            min={PORTFOLIO_SETTINGS_CONSTRAINTS.chatMaxLlmPerVisitorMin}
            max={PORTFOLIO_SETTINGS_CONSTRAINTS.chatMaxLlmPerVisitorMax}
            value={draft.chatMaxLlmPerVisitor}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                chatMaxLlmPerVisitor: Number(e.target.value),
              }))
            }
            className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none ${inputCls}`}
          />
        </div>
        <div>
          <label className={`block text-[10px] font-mono uppercase mb-1 ${mutedCls}`}>
            Max live sessions / visitor
          </label>
          <input
            type="number"
            min={PORTFOLIO_SETTINGS_CONSTRAINTS.chatMaxLiveSessionsPerVisitorMin}
            max={PORTFOLIO_SETTINGS_CONSTRAINTS.chatMaxLiveSessionsPerVisitorMax}
            value={draft.chatMaxLiveSessionsPerVisitor}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                chatMaxLiveSessionsPerVisitor: Number(e.target.value),
              }))
            }
            className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none ${inputCls}`}
          />
        </div>
        <div>
          <label className={`block text-[10px] font-mono uppercase mb-1 ${mutedCls}`}>
            Rate window (hours)
          </label>
          <input
            type="number"
            min={PORTFOLIO_SETTINGS_CONSTRAINTS.chatRateWindowHoursMin}
            max={PORTFOLIO_SETTINGS_CONSTRAINTS.chatRateWindowHoursMax}
            value={draft.chatRateWindowHours}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                chatRateWindowHours: Number(e.target.value),
              }))
            }
            className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none ${inputCls}`}
          />
        </div>
      </div>

      <div>
        <label className={`block text-[10px] font-mono uppercase mb-1 ${mutedCls}`}>
          Cursor model id (optional — empty uses account default)
        </label>
        <input
          type="text"
          maxLength={PORTFOLIO_SETTINGS_CONSTRAINTS.chatLlmModelMaxLength}
          value={draft.chatLlmModel}
          onChange={(e) => setDraft((prev) => ({ ...prev, chatLlmModel: e.target.value }))}
          placeholder="e.g. composer-2"
          className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none ${inputCls}`}
        />
      </div>
    </div>
  );
}
