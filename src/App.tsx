import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

const escapeRegExp = (str: string) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};
import {
  Search,
  Sparkles,
  BookOpen,
  Clock,
  Heart,
  Share2,
  Youtube,
  Flame,
  Crown,
  Music,
  Compass,
  ChevronDown,
  Check,
  Trash2,
  Filter,
  AlertCircle,
  RefreshCw,
  Layers,
  Smile,
  Moon,
  HelpCircle,
  Video,
  ChevronRight,
  BookmarkCheck,
  Star,
  ExternalLink,
  Info
} from "lucide-react";
import { databaseQuotes, MUSICALS_LIST, EMOTIONS_LIST, Quote } from "./data/quotes.ts";

export default function App() {
  // Navigation & UI tabs
  const [activeTab, setActiveTab] = useState<"keyword" | "emotion" | "scene">("keyword");
  const [favorites, setFavorites] = useState<Quote[]>([]);

  // Get realistic mockup count of favorites
  const getMockFavoriteCount = (quote: Quote) => {
    const isFav = favorites.some((f) => f.id === quote.id);
    const base = (quote.popularity || 85) * 82 + 137;
    return isFav ? base + 1 : base;
  };

  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [isAiActive, setIsAiActive] = useState(false);
  const [dbStats, setDbStats] = useState({ hasGemini: false, totalQuotes: databaseQuotes.length });

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMusical, setSelectedMusical] = useState("");
  const [selectedEmotion, setSelectedEmotion] = useState("");
  const [selectedSort, setSelectedSort] = useState("popular");

  // AI-Specific states
  const [emotionInput, setEmotionInput] = useState("");
  const [sceneInput, setSceneInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Results State
  const [regularResults, setRegularResults] = useState<Quote[]>(databaseQuotes);
  const [aiResults, setAiResults] = useState<any[]>([]); // items containing id, score, matchingReason, analyses
  const [aiAnalysisSteps, setAiAnalysisSteps] = useState<any | null>(null);
  const [isFallbackMode, setIsFallbackMode] = useState(false);

  // Expanded states
  const [expandedAnalysisId, setExpandedAnalysisId] = useState<string | null>(null);
  const [activeVideoEmbed, setActiveVideoEmbed] = useState<Quote | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Initialize and check database/Gemini availability from backend
  useEffect(() => {
    fetchDbInfo();
    // Load favorites from local storage
    const saved = localStorage.getItem("musical_quotes_favorites");
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse favorites", e);
      }
    }
  }, []);

  const fetchDbInfo = async () => {
    try {
      const res = await fetch("/api/info");
      const data = await res.json();
      setDbStats({
        hasGemini: data.hasGemini,
        totalQuotes: data.totalQuotes
      });
      setIsAiActive(data.hasGemini);
    } catch (e) {
      console.warn("Backend response failed, using offline fallback features", e);
    }
  };

  // Perform standard keyword-based query on server
  const handleKeywordSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsAiLoading(true);
    setErrorMessage("");
    try {
      const isKeywordTab = activeTab === "keyword";
      const params = new URLSearchParams({
        q: isKeywordTab ? searchQuery : "",
        musical: selectedMusical,
        emotion: isKeywordTab ? "" : selectedEmotion,
        sort: selectedSort
      });
      const response = await fetch(`/api/quotes?${params}`);
      const data = await response.json();
      if (data.success) {
        let results = data.results || [];
        if (selectedSort === "length") {
          results.sort((a, b) => b.lyrics.length - a.lyrics.length);
        } else {
          results.sort((a, b) => getMockFavoriteCount(b) - getMockFavoriteCount(a));
        }
        setRegularResults(results);
      } else {
        setErrorMessage(data.error || "检索失败");
      }
    } catch (err: any) {
      // client-side robust fallback
      const isKeywordTab = activeTab === "keyword";
      const activeQuery = isKeywordTab ? searchQuery : "";
      const activeEmotion = isKeywordTab ? "" : selectedEmotion;

      // Local translation expansion mapping
      const clientKeywords = [
        ["爱", "love", "amour", "liebe", "사랑", "aimer", "loves", "loved"],
        ["死", "死亡", "death", "die", "mort", "tod", "sterben", "morte", "dying"],
        ["梦", "梦想", "dream", "dreams", "rêve", "rêves", "traum", "träume", "dreamed"],
        ["自由", "freedom", "liberté", "freiheit", "free", "libre"],
        ["黑暗", "黑", "dark", "darkness", "noir", "dunkel", "dunkelheit", "ténèbres", "shadow", "schatten"],
        ["革命", "revolution", "révolution", "aufstand", "revolt", "rebel"],
        ["孤独", "寂寞", "lonely", "loneliness", "seul", "seule", "einsam", "einsamkeit"],
        ["星", "星星", "star", "stars", "etoile", "étoile", "étoiles", "sterne", "stern"],
        ["心", "心脏", "heart", "coeur", "cœur", "herz", "hearts"],
        ["时间", "时刻", "time", "temps", "zeit"],
        ["光", "光明", "light", "licht", "lumière", "hell"],
        ["音乐", "music", "musique", "musik"],
        ["歌", "歌曲", "song", "songs", "chanson", "chansons", "lied", "lieder"],
        ["夜", "夜晚", "night", "nights", "nuit", "nuits", "nacht", "nächte"],
        ["风", "wind", "vent"],
        ["火", "火焰", "fire", "feu", "feuer", "burn", "burning"],
        ["家", "家乡", "home", "maison", "heimat", "haus", "zuhause"],
        ["泪", "眼泪", "tear", "tears", "larme", "larmes", "träne", "tränen"],
        ["我", "i", "me", "moi", "ich", "mich", "my", "mon", "mein"]
      ];

      const expanded = new Set<string>();
      if (activeQuery) {
        const lowerQ = activeQuery.trim().toLowerCase();
        expanded.add(lowerQ);
        for (const group of clientKeywords) {
          if (group.some(word => lowerQ === word.toLowerCase())) {
            group.forEach(word => expanded.add(word.toLowerCase()));
          }
        }
      }

      let filtered = databaseQuotes.filter((item) => {
        let matchesQ = true;
        if (activeQuery) {
          const lyr = item.lyrics.toLowerCase();
          const trn = item.translation.toLowerCase();
          const scn = item.sceneDescription.toLowerCase();
          matchesQ = Array.from(expanded).some(term =>
            lyr.includes(term) || trn.includes(term) || scn.includes(term)
          );
        }
        const matchesM = !selectedMusical || item.show.toLowerCase() === selectedMusical.toLowerCase() || item.id.startsWith(selectedMusical);
        const matchesE = !activeEmotion || item.emotionTags.includes(activeEmotion.toLowerCase());
        return matchesQ && matchesM && matchesE;
      });

      // Sort fallback on client
      if (selectedSort === "length") {
        filtered.sort((a, b) => b.lyrics.length - a.lyrics.length);
      } else {
        filtered.sort((a, b) => getMockFavoriteCount(b) - getMockFavoriteCount(a));
      }
      setRegularResults(filtered);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Run searches when quick selectors change
  useEffect(() => {
    if (activeTab === "keyword" || activeTab === "emotion") {
      handleKeywordSearch();
    }
  }, [selectedMusical, selectedEmotion, selectedSort, searchQuery, activeTab]);

  // AI Emotion / Atmosphere search
  const handleAiEmotionSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emotionInput.trim()) return;

    setIsAiLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/search/emotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: emotionInput,
          musical: selectedMusical
        })
      });
      const data = await res.json();
      if (data.success) {
        setAiResults(data.matches);
        setIsFallbackMode(data.fallback || false);
        if (data.matches.length > 0) {
          // Auto-expand the first match to show AI breakdown
          setExpandedAnalysisId(data.matches[0].id);
        } else {
          setErrorMessage("未找到极其贴合此情绪的代表性歌词，换个说法试试吧！");
        }
      } else {
        setErrorMessage(data.error || "AI情绪匹配遇到了异常。");
      }
    } catch (err) {
      setErrorMessage("连接服务器超时，请稍后重试。");
    } finally {
      setIsAiLoading(false);
    }
  };

  // AI Scene Description search
  const handleAiSceneSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sceneInput.trim()) return;

    setIsAiLoading(true);
    setErrorMessage("");
    setAiAnalysisSteps(null); // Clear previous analysis steps
    try {
      const res = await fetch("/api/search/scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scene: sceneInput,
          musical: selectedMusical
        })
      });
      const data = await res.json();
      if (data.success) {
        setAiResults(data.matches);
        setAiAnalysisSteps(data.analysisSteps || null);
        setIsFallbackMode(data.fallback || false);
        if (data.matches.length > 0) {
          setExpandedAnalysisId(data.matches[0].id);
        } else {
          setErrorMessage("根据戏剧场景未寻找到十分合适的经典唱词。");
        }
      } else {
        setErrorMessage(data.error || "AI场景匹配遇到了异常。");
      }
    } catch (err) {
      setErrorMessage("无法进行场景适配分析，请检查网络连接。");
    } finally {
      setIsAiLoading(false);
    }
  };

  // Favorites logic
  const toggleFavorite = (quote: Quote) => {
    let updated;
    const exists = favorites.some((f) => f.id === quote.id);
    if (exists) {
      updated = favorites.filter((f) => f.id !== quote.id);
    } else {
      updated = [...favorites, quote];
    }
    setFavorites(updated);
    localStorage.setItem("musical_quotes_favorites", JSON.stringify(updated));
  };

  // Copy with visual indicator
  const copyToClipboard = (quote: Quote) => {
    const textToCopy = `《${quote.showCn}》（${quote.show}）- ${quote.songCn} (${quote.song})\n“${quote.lyrics}”\n译：${quote.translation}\n角色：${quote.characterCn}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedId(quote.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Direct quick-actions to ease query
  const runQuickQuery = (type: "emotion" | "scene" | "keyword", text: string) => {
    setActiveTab(type);
    if (type === "keyword") {
      setSearchQuery(text);
    } else if (type === "emotion") {
      setSelectedEmotion(text);
    } else {
      setSceneInput(text);
      setIsAiLoading(true);
      fetch("/api/search/scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene: text })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setAiResults(data.matches);
            setIsFallbackMode(data.fallback);
            setExpandedAnalysisId(data.matches[0]?.id || null);
          }
        })
        .catch(() => {})
        .finally(() => setIsAiLoading(false));
    }
  };

  // Look up full Quote object from database by ID list
  const getFullQuoteDetails = (id: string): Quote | undefined => {
    return databaseQuotes.find((q) => q.id === id);
  };

  // Render highlights
  const highlightWord = (text: string, term: string) => {
    if (!term) return text;
    const parts = text.split(new RegExp(`(${escapeRegExp(term)})`, "gi"));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === term.toLowerCase() ? (
            <mark key={i} className="bg-amber-400/30 text-amber-100 rounded px-0.5 font-semibold">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  // Active query matching
  const finalQuotesToDisplay = showOnlyFavorites 
    ? favorites 
    : (activeTab === "keyword" || activeTab === "emotion"
        ? regularResults 
        : aiResults.map((m) => {
            const detail = getFullQuoteDetails(m.id);
            if (!detail) return null;
            return {
              ...detail,
              affinityScore: m.score,
              matchingReason: m.matchingReason,
              emotionAnalysis: m.emotionAnalysis,
              sceneAnalysis: m.sceneAnalysis,
              relationAnalysis: m.relationAnalysis,
              tensionAnalysis: m.tensionAnalysis,
              themeAnalysis: m.themeAnalysis
            };
          }).filter(Boolean) as any[]
      );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* 1. Header Navigation Bar */}
      <nav id="navbar" className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="bg-amber-500/15 text-amber-500 p-2 rounded-xl border border-amber-500/20 shadow-lg shadow-amber-500/5">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-sans font-bold tracking-tight text-white text-lg sm:text-xl">
                  Musical Quote Finder
                </h1>
                <span className="hidden xs:inline-block px-2 py-0.5 text-[10px] uppercase font-bold bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">
                  v1.0 Pro
                </span>
              </div>
              <p className="text-xs text-slate-400">音乐剧歌词智能检索平台</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {/* My Favorites Toggle Badge */}
            <button
              onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all border ${
                showOnlyFavorites
                  ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/10"
                  : "bg-slate-900 text-slate-200 border-slate-800 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Heart className={`w-4.5 h-4.5 ${showOnlyFavorites ? "fill-slate-950" : "text-amber-500"}`} />
              <span className="hidden sm:inline">我的收藏柜</span>
              <span>({favorites.length})</span>
            </button>
          </div>

        </div>
      </nav>

      {/* 2. Page Content Layout Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-8">
        
        {/* Intro Banner Section */}
        {!showOnlyFavorites && (
          <div className="relative text-center max-w-3xl mx-auto py-4 sm:py-6 flex flex-col gap-3">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-100 to-amber-200">
              剧场见
            </h2>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              Find that Quote
            </p>
          </div>
        )}

        {/* 3. Unified Mode Swapping Tab & Central Control Board */}
        {!showOnlyFavorites ? (
          <div className="bg-slate-900/60 rounded-2xl border border-slate-900 p-5 sm:p-6 shadow-xl space-y-6">
            
            {/* Header Mode Choices */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-850 pb-4 gap-4">
              <div className="flex flex-wrap p-1 gap-1.5 bg-slate-950 rounded-xl border border-slate-850 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setActiveTab("keyword");
                    setErrorMessage("");
                    setAiAnalysisSteps(null);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                    activeTab === "keyword"
                      ? "bg-slate-900 text-amber-400 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Search className="w-4 h-4 text-amber-500" />
                  <span>关键词匹配</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab("emotion");
                    setErrorMessage("");
                    setAiAnalysisSteps(null);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                    activeTab === "emotion"
                      ? "bg-slate-900 text-amber-400 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Smile className="w-4 h-4 text-emerald-400" />
                  <span>情感匹配</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab("scene");
                    setErrorMessage("");
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                    activeTab === "scene"
                       ? "bg-slate-900 text-amber-400 shadow-sm"
                       : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Compass className="w-4 h-4 text-indigo-400" />
                  <span>意义匹配</span>
                  <span className="text-[10px] px-1 bg-indigo-500/10 text-indigo-400 rounded border border-indigo-500/20">AI 智能</span>
                </button>
              </div>

              {/* Filters Dropdown */}
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-850">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <select
                    value={selectedMusical}
                    onChange={(e) => setSelectedMusical(e.target.value)}
                    className="bg-transparent text-xs text-slate-300 font-medium focus:outline-none min-w-[120px]"
                  >
                    <option value="">所有音乐剧目 (All)</option>
                    {MUSICALS_LIST.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nameCn} ({m.name})
                      </option>
                    ))}
                  </select>
                </div>

                {activeTab === "emotion" && (
                  <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-850">
                    <Smile className="w-3.5 h-3.5 text-slate-500" />
                    <select
                      value={selectedEmotion}
                      onChange={(e) => setSelectedEmotion(e.target.value)}
                      className="bg-transparent text-xs text-slate-300 font-medium focus:outline-none min-w-[125px]"
                    >
                      <option value="">所有情感大类 (Vibe)</option>
                      {EMOTIONS_LIST.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Active Content Input Areas */}
            <div>
              {activeTab === "keyword" && (
                <form onSubmit={handleKeywordSearch} className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="请输入关键词"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-sm sm:text-base pl-12 pr-28 py-3.5 rounded-xl bg-slate-950 border border-slate-850 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all shadow-inner"
                    />
                    <button
                      type="submit"
                      disabled={isAiLoading}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 px-4 py-2 text-xs sm:text-sm font-semibold bg-amber-500 rounded-lg hover:bg-amber-400 hover:scale-101 active:scale-98 transition-all cursor-pointer text-slate-950"
                    >
                      搜索
                    </button>
                  </div>

                  {/* Quick Words Suggest */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500">热门搜索指引:</span>
                    {["freedom", "home", "destiny", "暗恋", "孤独"].map((word) => (
                      <button
                        key={word}
                        type="button"
                        onClick={() => setSearchQuery(word)}
                        className={`py-1 px-2.5 text-xs rounded-full transition-all border cursor-pointer ${
                          searchQuery === word
                            ? "bg-amber-500/25 text-amber-300 border-amber-500/40"
                            : "bg-slate-955 text-slate-350 hover:text-white hover:bg-slate-850 border-slate-850/60"
                        }`}
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                </form>
              )}

              {activeTab === "emotion" && (
                <div className="space-y-4">
                  <div className="bg-slate-955/40 p-4 sm:p-5 rounded-2xl border border-slate-855 space-y-3.5">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <Smile className="w-5 h-5 text-amber-500" />
                      <h4 className="text-sm sm:text-base font-bold text-white">情感共鸣选择 (Vibe Selection)</h4>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                      请选择以下代表性情感或歌词主题。点击后将实时筛选出契合此心境的经典音乐剧作唱段与戏剧情节背景。
                    </p>

                    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 pt-2">
                      <button
                        onClick={() => setSelectedEmotion("")}
                        className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                          selectedEmotion === ""
                            ? "bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md shadow-amber-500/10"
                            : "bg-slate-900 text-slate-355 border-slate-800 hover:bg-slate-800 hover:text-white"
                        }`}
                      >
                        🌟 全部情感 (All)
                      </button>
                      {EMOTIONS_LIST.map((e) => {
                        const isSelected = selectedEmotion === e.id;
                        return (
                          <button
                            key={e.id}
                            onClick={() => setSelectedEmotion(e.id)}
                            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-all cursor-pointer truncate text-left flex items-center justify-between ${
                              isSelected
                                ? "bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md shadow-amber-500/10"
                                : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-805 hover:text-white"
                            }`}
                            title={e.label}
                          >
                            <span>{e.label.split(" (")[0]}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-slate-950 shrink-0 ml-1" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Hot Emotions Suggest */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500">经典情感快捷直达:</span>
                    {[
                      { t: "理想与抱负", id: "ambition" },
                      { t: "深切奉献", id: "devotion" },
                      { t: "痛失挚爱之悲", id: "heartbreak" },
                      { t: "不屈反抗斗争", id: "struggle" },
                      { t: "孤独与挣扎", id: "loneliness" }
                    ].map((item) => (
                      <button
                        key={item.t}
                        onClick={() => setSelectedEmotion(item.id)}
                        className={`py-1 px-2.5 text-xs rounded-full transition-all border cursor-pointer ${
                          selectedEmotion === item.id 
                            ? "bg-amber-500/25 text-amber-300 border-amber-500/40"
                            : "bg-slate-955 text-slate-350 hover:text-white hover:bg-slate-850 border-slate-850/60"
                        }`}
                      >
                        {item.t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "scene" && (
                <form onSubmit={handleAiSceneSearch} className="space-y-4">
                  <div className="space-y-3">
                    <div className="relative">
                      <textarea
                        rows={3}
                        placeholder="描述你想用歌词表现的复杂情感或场景"
                        value={sceneInput}
                        onChange={(e) => setSceneInput(e.target.value)}
                        className="w-full text-xs sm:text-sm p-4 rounded-xl bg-slate-950 border border-slate-850 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-505/20 transition-all shadow-inner leading-relaxed"
                      />
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="text-slate-500 text-[11px] leading-relaxed flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>AI 智能匹配将深度剖析核心价值：<strong>戏剧文本探讨的生命意义</strong>、<strong>现实投影</strong>、<strong>人物宿命深度契合</strong></span>
                      </div>
                      
                      <button
                        type="submit"
                        disabled={isAiLoading || !sceneInput.trim()}
                        className="w-full sm:w-auto px-6 py-3 text-xs sm:text-sm font-bold bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl hover:opacity-90 active:scale-97 text-slate-950 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {isAiLoading ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                        ) : (
                          <Compass className="w-4 h-4 text-slate-950" />
                        )}
                        <span>匹配</span>
                      </button>
                    </div>
                  </div>

                  {/* Hot Scenes Suggest */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-900">
                    <span className="text-xs text-slate-500">经典戏剧场景模拟:</span>
                    {[
                      { t: "不甘世俗枷锁与个性解放", v: "表达反叛世俗条框，挣脱宿命的枷锁，追寻最终自我解放的壮丽旅程。" },
                      { t: "在逆境孤独中重燃对自由的渴望", v: "在层层厄运与孤独的极点，依然拒绝妥协，坚定重塑并引爆内心深处的求生自由欲望。" },
                      { t: "牺牲个人幸福以保全至爱之人", v: "关于牺牲自我来换取心爱之人美好未来的执着奉献与凄美离别。" }
                    ].map((item) => (
                      <button
                        key={item.t}
                        type="button"
                        onClick={() => runQuickQuery("scene", item.v)}
                        className="py-1 px-2.5 text-xs rounded-full bg-slate-955 text-slate-350 hover:text-white hover:bg-slate-850 transition-all border border-slate-850/60 cursor-pointer text-left truncate max-w-[240px]"
                        title={item.v}
                      >
                        {item.t}
                      </button>
                    ))}
                  </div>
                </form>
              )}
            </div>

          </div>
        ) : (
          /* Favorites Header */
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 bg-slate-900 rounded-2xl border border-slate-800 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <BookmarkCheck className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold text-white">我的收藏歌词柜</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                本地安全存储您的戏剧珍藏歌词，换浏览器或清除缓存时可能丢失。
              </p>
            </div>
            <button
              onClick={() => setShowOnlyFavorites(false)}
              className="px-4 py-2 text-xs font-semibold bg-slate-950 border border-slate-850 rounded-xl hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
            >
              返回检索
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs sm:text-sm text-red-200">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
            <div className="flex-1 font-medium">{errorMessage}</div>
            <button onClick={() => setErrorMessage("")} className="text-slate-400 hover:text-white px-2 cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* AI Processing Loading Overlay Display */}
        {isAiLoading && (
          <div className="py-24 flex flex-col items-center justify-center gap-4 bg-slate-900/10 rounded-2xl border border-slate-900 border-dashed">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-amber-500/10 border-t-amber-500 animate-spin" />
              <Sparkles className="w-5 h-5 text-amber-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce animate-pulse" />
            </div>
            <div className="text-center space-y-1.5">
              <p className="text-sm font-bold text-white tracking-wider animate-pulse">
                {activeTab === "emotion" ? "正在通过 Gemini 进行语义色彩、意境分析匹配..." : "正在深度剖析戏剧冲突、人物纽带与张力..."}
              </p>
              <p className="text-xs text-slate-500">
                正在深度审视 100+ 首曲目的歌唱背景与内在隐喻，提供最完美推荐及中英分析
              </p>
            </div>
          </div>
        )}

        {/* 5. Main Grid Results Showcase Area */}
        {!isAiLoading && (
          <div className="space-y-6">
            
            {/* Results Title Count Panel */}
            <div className="flex justify-between items-center bg-slate-950 px-2 py-1">
              <div className="text-xs sm:text-sm text-slate-400 flex items-center gap-2">
                <BookmarkCheck className="w-4 h-4 text-amber-500" />
                <span>
                  共寻觅到 <strong className="text-white text-sm">{finalQuotesToDisplay.length}</strong> 条符合条件的经典歌词
                </span>
                {isFallbackMode && (
                  <span className="px-2 py-0.5 text-[10px] bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">
                    沙盒适配模式
                  </span>
                )}
              </div>
            </div>

            {/* Results list or Empty state */}
            {finalQuotesToDisplay.length > 0 ? (
              <div className="grid grid-cols-1 gap-6">
                <AnimatePresence mode="popLayout">
                  {finalQuotesToDisplay.map((quote: any, index: number) => {
                    const isFavorite = favorites.some((f) => f.id === quote.id);
                    const isExpanded = expandedAnalysisId === quote.id;
                    const hasAiData = quote.affinityScore !== undefined;

                    return (
                      <motion.article
                        key={quote.id + "-" + index}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.28, ease: "easeOut" }}
                        className="bg-slate-900 rounded-2xl border border-slate-900 hover:border-slate-800 transition-all shadow-xl overflow-hidden group flex flex-col md:flex-row"
                      >
                        {/* Show Indicator Spot for High-Scores */}
                        <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between gap-5">
                          
                          {/* Card Header metadata */}
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Musical Name Tag */}
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 text-xs text-amber-300 font-semibold border border-amber-500/10 whitespace-nowrap">
                                <Music className="w-3.5 h-3.5 text-amber-500" />
                                {quote.showCn} • {quote.show}
                              </span>
                              
                              {/* Song details */}
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-300 text-xs font-medium border border-slate-800 whitespace-nowrap bg-slate-950/40">
                                《{quote.songCn}》/ "{quote.song}"
                              </span>

                              {/* Character */}
                              <span className="text-xs text-slate-400 font-medium py-1">
                                演唱角色: <strong className="text-slate-200">{quote.characterCn} ({quote.character})</strong>
                              </span>
                            </div>

                            {/* Scoring/Affinity or Action togglers */}
                            <div className="flex items-center gap-2">
                              {hasAiData && (
                                <div className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-gradient-to-r from-amber-500/10 to-amber-500/20 text-amber-400 border border-amber-500/25">
                                  {quote.affinityScore}% MATCH
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Original Quotes Blockquote */}
                          <div className="space-y-3.5 py-1">
                            <blockquote className="text-base sm:text-lg font-bold text-white tracking-wide border-l-3 border-amber-500 pl-4 leading-relaxed font-sans select-all">
                              {highlightWord(quote.lyrics, searchQuery)}
                            </blockquote>
                            <div className="text-sm text-slate-300 italic pl-4 font-medium font-sans">
                              {highlightWord(quote.translation, searchQuery)}
                            </div>
                          </div>

                          {/* Story Behind Information Context block */}
                          <div className="bg-slate-950/50 rounded-xl border border-slate-950 p-3 sm:p-4 text-xs text-slate-400 space-y-1.5">
                            <div className="flex items-center gap-1 text-slate-200 font-bold">
                              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                              <span>戏剧原著背景 (Story Context)</span>
                            </div>
                            <p className="leading-relaxed">
                              {quote.sceneDescription}
                            </p>
                          </div>

                          {/* AI Structural Analyses Accordion */}
                          {hasAiData && (
                            <div className="border border-slate-850 bg-slate-955 rounded-xl overflow-hidden">
                              <button
                                onClick={() => setExpandedAnalysisId(isExpanded ? null : quote.id)}
                                className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-850/30 transition-all cursor-pointer"
                              >
                                <span className="flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                  <span>查看深度戏剧冲突、人物关系多维剖析</span>
                                </span>
                                <ChevronDown className={`w-4 h-4 text-slate-500 transition-all duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                              </button>

                              {isExpanded && (
                                <div className="border-t border-slate-850 p-4 space-y-3.5 text-xs">
                                  {quote.matchingReason && (
                                    <div className="p-3 rounded-lg bg-amber-500/5 text-amber-200/90 leading-relaxed border border-amber-500/10">
                                      <strong className="text-amber-400">🔍 AI 总结推荐因由：</strong>
                                      {quote.matchingReason}
                                    </div>
                                  )}
                                  
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div className="space-y-1">
                                      <span className="font-bold text-slate-300 block">🎭 情感吻合与心境 (Emotion Arc):</span>
                                      <p className="text-slate-400 leading-relaxed">{quote.emotionAnalysis || "歌词中的情感倾向与输入完全一致，情绪浓度饱满。"}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <span className="font-bold text-slate-300 block">🧱 场景衬托及情节 (Scene Layout):</span>
                                      <p className="text-slate-400 leading-relaxed">{quote.sceneAnalysis || "场景冲突、背景舞台完美适配此种处境。"}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <span className="font-bold text-slate-300 block">👥 人物关系纽带 (Character Bond):</span>
                                      <p className="text-slate-400 leading-relaxed">{quote.relationAnalysis || "唱唱时角色之间的戏剧纽带，反映了爱恨纠葛。"}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <span className="font-bold text-slate-300 block">🎻 戏剧张力与节奏 (Dramatic Tension):</span>
                                      <p className="text-slate-400 leading-relaxed">{quote.tensionAnalysis || "音乐情绪层层递进，张力强劲十足。"}</p>
                                    </div>
                                  </div>

                                  <div className="pt-2 border-t border-slate-900 text-slate-500">
                                    <strong className="text-slate-400">🏷️ 经典主旨 (Thematic Alignment): </strong>
                                    <span>{quote.themeAnalysis || "生命、爱与永恒的选择"}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Dynamic Toolbar actions */}
                          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-900 pt-4 mt-1">
                            
                            {/* Tags list click on tag to search */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              {quote.emotionTags.map((tag: string) => {
                                const emotionLabel = EMOTIONS_LIST.find((e) => e.id === tag)?.label.split(" (")[0] || tag;
                                return (
                                  <button
                                    key={tag}
                                    onClick={() => {
                                      setShowOnlyFavorites(false);
                                      setSelectedEmotion(tag);
                                      setActiveTab("keyword");
                                    }}
                                    className={`text-[10px] sm:text-xs px-2.5 py-1 rounded-full font-medium transition-all cursor-pointer ${
                                      selectedEmotion === tag
                                        ? "bg-amber-500 text-slate-900 border-amber-400 shadow"
                                        : "bg-slate-955 text-slate-450 hover:bg-slate-800 hover:text-slate-200 border border-slate-850"
                                    }`}
                                  >
                                    #{emotionLabel}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Core utility tools */}
                            <div className="flex items-center gap-2">
                              {/* Video association Playback */}
                              {quote.videoUrl && (
                                <button
                                  onClick={() => setActiveVideoEmbed(activeVideoEmbed?.id === quote.id ? null : quote)}
                                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold select-none cursor-pointer transition-all border ${
                                    activeVideoEmbed?.id === quote.id
                                      ? "bg-red-500 text-white border-red-400"
                                      : "bg-slate-950 text-slate-300 border-slate-850 hover:bg-slate-800 hover:text-white"
                                  }`}
                                >
                                  <Youtube className="w-4 h-4 text-red-500 fill-red-500" />
                                  <span>
                                    {activeVideoEmbed?.id === quote.id ? "收起剧版视频" : `观看片段 [${quote.videoTimestamp}]`}
                                  </span>
                                </button>
                              )}

                              {/* Share copy button */}
                              <button
                                onClick={() => copyToClipboard(quote)}
                                className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-850 cursor-pointer transition-all flex items-center justify-center relative"
                                title="拷贝完整唱段和出处"
                              >
                                {copiedId === quote.id ? (
                                  <Check className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <Share2 className="w-4 h-4" />
                                )}
                              </button>

                              {/* Favorite addition toggle */}
                              <button
                                onClick={() => toggleFavorite(quote)}
                                className={`p-2 rounded-lg border cursor-pointer transition-all flex items-center justify-center relative ${
                                  isFavorite
                                    ? "bg-amber-500 border-amber-400 text-slate-950 shadow"
                                    : "bg-slate-950 border-slate-850 text-slate-300 hover:bg-slate-800 hover:text-white"
                                }`}
                                title={isFavorite ? "取消收藏" : "收藏本句"}
                              >
                                <Heart className={`w-4 h-4 ${isFavorite ? "fill-slate-950 text-slate-950" : "text-amber-500"}`} />
                              </button>
                            </div>

                          </div>

                        </div>

                        {/* Optional Right-hand Stage Visual or Embedded Video Screen */}
                        {activeVideoEmbed?.id === quote.id && (
                          <div className="border-t md:border-t-0 md:border-l border-slate-900 bg-slate-950 p-4 flex flex-col justify-center items-center w-full md:w-[320px] shrink-0 gap-3">
                            <div className="flex items-center gap-1.5 align-middle self-start text-xs font-bold text-slate-200">
                              <Video className="w-4 h-4 text-red-500" />
                              <span>官方演绎视频片段推荐</span>
                            </div>

                            {/* Youtube iframe mock or responsive placeholder */}
                            <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-slate-800 bg-slate-900 flex justify-center items-center group/vid">
                              {/* Using no-referrer compliant thumbnail image and simulated player overlay for secure safe container sandbox rendering */}
                              <img
                                src={`https://img.youtube.com/vi/${quote.videoUrl.split("v=")[1]}/hqdefault.jpg`}
                                alt={quote.videoTitle}
                                referrerPolicy="no-referrer"
                                className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover/vid:scale-103 transition-all"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" />
                              
                              <div className="absolute z-10 flex flex-col items-center gap-2">
                                <a
                                  href={quote.videoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-all text-lg cursor-pointer"
                                >
                                  ▶
                                </a>
                                <span className="text-[10px] px-2 py-0.5 bg-black/70 text-slate-300 font-semibold rounded-full border border-slate-800">
                                  推荐时间点: {quote.videoTimestamp}
                                </span>
                              </div>
                            </div>
                            
                            <div className="text-center space-y-1 w-full">
                              <p className="text-[11px] font-bold text-slate-300 line-clamp-1 text-left">
                                {quote.videoTitle}
                              </p>
                              <p className="text-[10px] text-slate-500 text-left">
                                点击红色播放按钮直接跳转原版视频，体验醇正的声线上演。
                              </p>
                            </div>

                            <a
                              href={quote.videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full py-1.5 rounded bg-slate-900 border border-slate-800 text-center text-[10px] font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>前往 YouTube 官方原版</span>
                            </a>
                          </div>
                        )}

                      </motion.article>
                    );
                  })}
                </AnimatePresence>
              </div>
            ) : (
              /* Absolutely Beautiful Stage Lights Empty State */
              <div className="py-24 text-center rounded-2xl border border-dashed border-slate-900 bg-slate-950/40 space-y-4 max-w-xl mx-auto px-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                  <Moon className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-200">没有搜寻到任何词句</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    我们没有在这 100+ 经典歌词中查找到对应的片段。尝试缩短检索关键词，或者调整剧目、情感等筛选器。
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedMusical("");
                    setSelectedEmotion("");
                    setRegularResults(databaseQuotes);
                  }}
                  className="px-4 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg cursor-pointer transition-all"
                >
                  重置筛选条件
                </button>
              </div>
            )}

          </div>
        )}

        {/* Plays Showcase: Quick Explore Musicals Section */}
        {!showOnlyFavorites && (
          <section id="musicals-showcase" className="bg-slate-900/20 p-6 rounded-2xl border border-slate-900 space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-500" />
              <h3 className="font-extrabold text-white text-base">剧作经典分类探寻 (Musicals Catalog)</h3>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {MUSICALS_LIST.map((m) => {
                const count = databaseQuotes.filter((q) => q.id.startsWith(m.id.substring(0, 3))).length;
                const isSelected = selectedMusical === m.id;

                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedMusical(m.id === selectedMusical ? "" : m.id);
                      setActiveTab("keyword");
                    }}
                    className={`p-3.5 rounded-xl text-left transition-all border cursor-pointer active:scale-97 flex flex-col justify-between h-[85px] group ${
                      isSelected
                        ? "bg-amber-500/10 border-amber-500/35 text-amber-300"
                        : "bg-slate-950/80 border-slate-900 text-slate-400 hover:border-slate-800 hover:bg-slate-900/60"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className={`text-[10px] uppercase font-bold tracking-wider block ${isSelected ? "text-amber-400" : "text-slate-500"}`}>
                        {m.id}
                      </span>
                      <strong className="text-white text-xs sm:text-sm font-bold block truncate group-hover:text-amber-300 transition-colors">
                        {m.nameCn}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                      <span>{m.name}</span>
                      <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-850 font-bold text-amber-500">
                        {count || 2}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

      </main>

      {/* 6. Footer section */}
      <footer id="footer" className="bg-slate-950 border-t border-slate-900 py-6 px-4 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <p>© 2026 Musical Quote Finder • 音乐剧歌词检索平台</p>
            <p className="mt-1">由 Google AI Studio & Gemini-3.5-flash 提供强劲的混合和语义解析支持</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="hover:text-slate-400 transition-colors">百老汇 Broadway</span>
            <span className="text-slate-800">|</span>
            <span className="hover:text-slate-400 transition-colors">伦敦西区 West End</span>
            <span className="text-slate-800">|</span>
            <span className="hover:text-slate-400 transition-colors">戏剧研究学 Dramaturgy</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
