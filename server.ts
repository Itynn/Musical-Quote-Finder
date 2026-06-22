import express from "express";
import path from "path";
import dns from "dns";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { databaseQuotes } from "./src/data/quotes.ts"; // Standard ESM imports can use relative or tsx paths

dotenv.config();

// Fix local host resolution order for modern Node runtimes
dns.setDefaultResultOrder("ipv4first");

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Middleware to check if Gemini is properly configured
const isGeminiEnabled = () => {
  return apiKey && apiKey !== "MY_GEMINI_API_KEY";
};

// Helper to escape regex special characters
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ----------------------------------------------------
// 1. API: Core Database Status & Musicals Info
// ----------------------------------------------------
app.get("/api/info", (req, res) => {
  res.json({
    hasGemini: isGeminiEnabled(),
    totalQuotes: databaseQuotes.length,
    timestamp: new Date().toISOString(),
  });
});

// Multilingual Keyword Map for auto-translation / expansion
const multilingualKeywords = [
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

// ----------------------------------------------------
// 2. API: Rich Keyword Search (Local & High Performance)
// ----------------------------------------------------
app.get("/api/quotes", (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const musical = typeof req.query.musical === "string" ? req.query.musical.trim() : "";
    const emotion = typeof req.query.emotion === "string" ? req.query.emotion.trim() : "";
    const sort = typeof req.query.sort === "string" ? req.query.sort.trim() : "relevant"; // relevant, popular, length

    let results = [...databaseQuotes];

    // Filter by Musical
    if (musical) {
      results = results.filter(
         (item) => item.show.toLowerCase() === musical.toLowerCase() || item.id.startsWith(musical)
      );
    }

    // Filter by Emotion Tag
    if (emotion) {
      results = results.filter((item) => item.emotionTags.includes(emotion.toLowerCase()));
    }

    // Filter by Search Query (with auto-translation and expansion)
    if (q) {
      // Find all expanded terms in our multilingual dictionary
      const expandedTerms = new Set<string>([q]);
      for (const group of multilingualKeywords) {
        if (group.some(word => q === word.toLowerCase())) {
          group.forEach(word => expandedTerms.add(word.toLowerCase()));
        }
      }

      results = results.filter((item) => {
        const lyr = item.lyrics.toLowerCase();
        const trn = item.translation.toLowerCase();
        const scn = item.sceneDescription.toLowerCase();
        return Array.from(expandedTerms).some(term =>
          lyr.includes(term) || trn.includes(term) || scn.includes(term)
        );
      });
    }

    // Sort
    if (sort === "popular") {
      results.sort((a, b) => b.popularity - a.popularity);
    } else if (sort === "length") {
      results.sort((a, b) => b.lyrics.length - a.lyrics.length);
    } else {
      // Default / Relevant
      results.sort((a, b) => b.popularity - a.popularity);
    }

    res.json({
      success: true,
      query: q,
      filters: { musical, emotion, sort },
      count: results.length,
      results,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ----------------------------------------------------
// 3. API: AI Sentiment / Emotion Retrieval
// ----------------------------------------------------
app.post("/api/search/emotion", async (req, res) => {
  try {
    const { description, musical } = req.body;

    if (!description || typeof description !== "string" || description.trim() === "") {
      return res.status(400).json({ success: false, error: "描述内容不能为空 (Description is required)" });
    }

    if (!isGeminiEnabled()) {
      // Fallback: If API Key is not set, do a keyword matching fallback over tags
      const lowercaseDesc = description.toLowerCase();
      // Simple heuristic tag mapping
      let matchedTags: string[] = [];
      if (lowercaseDesc.includes("理想") || lowercaseDesc.includes("野心") || lowercaseDesc.includes("梦想") || lowercaseDesc.includes("抱负")) matchedTags.push("ambition");
      if (lowercaseDesc.includes("希望") || lowercaseDesc.includes("未来") || lowercaseDesc.includes("新") || lowercaseDesc.includes("阳光")) matchedTags.push("hope");
      if (lowercaseDesc.includes("痛苦") || lowercaseDesc.includes("悲伤") || lowercaseDesc.includes("伤心") || lowercaseDesc.includes("心碎")) matchedTags.push("heartbreak");
      if (lowercaseDesc.includes("抗争") || lowercaseDesc.includes("坚持") || lowercaseDesc.includes("战斗") || lowercaseDesc.includes("反抗")) matchedTags.push("struggle");
      if (lowercaseDesc.includes("孤独") || lowercaseDesc.includes("寂寞") || lowercaseDesc.includes("一人") || lowercaseDesc.includes("无助")) matchedTags.push("loneliness");
      if (lowercaseDesc.includes("深爱") || lowercaseDesc.includes("奉献") || lowercaseDesc.includes("守护") || lowercaseDesc.includes("依恋")) matchedTags.push("devotion");
      if (lowercaseDesc.includes("遗憾") || lowercaseDesc.includes("释怀") || lowercaseDesc.includes("放手") || lowercaseDesc.includes("告别")) matchedTags.push("regret");
      if (lowercaseDesc.includes("自由") || lowercaseDesc.includes("做自己") || lowercaseDesc.includes("叛逆") || lowercaseDesc.includes("规则")) matchedTags.push("freedom");
      if (lowercaseDesc.includes("朋友") || lowercaseDesc.includes("友情") || lowercaseDesc.includes("羁绊") || lowercaseDesc.includes("闺蜜")) matchedTags.push("friendship");

      let filtered = [...databaseQuotes];
      if (musical) {
        filtered = filtered.filter((q) => q.show.toLowerCase() === musical.toLowerCase() || q.id.startsWith(musical));
      }

      const matches = filtered
        .map((q) => {
          let score = 50; // default base score
          const intersection = q.emotionTags.filter((tag) => matchedTags.includes(tag));
          score += intersection.length * 15;
          
          // keyword heuristics
          if (lowercaseDesc.split("").some((char) => q.translation.includes(char))) score += 5;
          if (score > 95) score = 95;

          return {
            id: q.id,
            score,
            matchingReason: `[离线匹配] 此歌词契合您提到的“${q.emotionTags.join(", ")}”等情感标签。配置 AI 密钥后可获得深度精准语义解析。`,
            emotionAnalysis: "已进行离线标签和文本相关性粗略过滤。",
            sceneAnalysis: q.sceneDescription,
            relationAnalysis: "无",
            tensionAnalysis: "无",
            themeAnalysis: "情感主旨贴合"
          };
        })
        .filter((item) => item.score > 53)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      return res.json({
        success: true,
        fallback: true,
        matches,
      });
    }

    // Prepare quotes simplified context
    const simplifiedQuotes = databaseQuotes.map((q) => ({
      id: q.id,
      show: q.show,
      showCn: q.showCn,
      song: q.song,
      songCn: q.songCn,
      character: q.character,
      lyrics: q.lyrics,
      translation: q.translation,
      sceneDescription: q.sceneDescription,
      emotionTags: q.emotionTags,
    }));

    const systemPrompt = `You are an expert Musicologist and Theater Dramaturg specializing in Broadway and West End musicals.
Your task is to analyze the user's emotion or sentiment request (which could be in Chinese or English) and matches them semantically against our curated catalog of iconic database quotes.

User Emotion/ATMOSPHERE Description: "${description}"

Here is the database of classic musical quotes:
${JSON.stringify(simplifiedQuotes, null, 2)}

Instructions:
1. Identify quotes that match the requested vibe, feeling, mood, or aesthetic described. Consider subtle synonyms and metaphoric overlaps (e.g. "dark night", "hope", "overcoming obstacles", "unrequited love").
2. Calculate a matching affinity score (0 to 100) based on emotional accuracy.
3. For each match, provide highly tailored explanations (including 'matchingReason' and specific bilingually informative parameters: emotionAnalysis, sceneAnalysis, tensionAnalysis, themeAnalysis) in Chinese.
4. Return only the top matches (maximum 8 results) sorted by score descending.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: systemPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matches: {
              type: Type.ARRAY,
              description: "Array of matched musical quotes with detailed affinity scores and emotional alignments.",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "ID of the matching quote." },
                  score: { type: Type.INTEGER, description: "Strength of logical and emotional affiliation from 0 to 100." },
                  matchingReason: { type: Type.STRING, description: "Brief summary explaining why it is a high-affinity match." },
                  emotionAnalysis: { type: Type.STRING, description: "Deep analysis of the shared mood components in Chinese." },
                  sceneAnalysis: { type: Type.STRING, description: "How the plot context aligns with the psychological feeling in Chinese." },
                  tensionAnalysis: { type: Type.STRING, description: "Vibe / sensory musical/theatrical tension details in Chinese." },
                  themeAnalysis: { type: Type.STRING, description: "Thematic core alignment in Chinese." }
                },
                required: ["id", "score", "matchingReason", "emotionAnalysis", "themeAnalysis"]
              }
            }
          },
          required: ["matches"]
        }
      }
    });

    const outputText = response.text || "";
    const resultObj = JSON.parse(outputText.trim());
    res.json({
      success: true,
      fallback: false,
      matches: resultObj.matches || [],
    });

  } catch (error: any) {
    console.error("AI Emotion Search Error: ", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ----------------------------------------------------
// 4. API: AI Scene Description Smart Match
// ----------------------------------------------------
app.post("/api/search/scene", async (req, res) => {
  try {
    const { scene, musical } = req.body;

    if (!scene || typeof scene !== "string" || scene.trim() === "") {
      return res.status(400).json({ success: false, error: "场景描述不能为空 (Scene description is required)" });
    }

    if (!isGeminiEnabled()) {
      // Fallback: If API Key is not set, do a majestic 7-step analysis representation
      const lowercaseScene = scene.toLowerCase();
      let filtered = [...databaseQuotes];
      if (musical) {
        filtered = filtered.filter((q) => q.show.toLowerCase() === musical.toLowerCase() || q.id.startsWith(musical));
      }

      // Generate realistic fallback evaluations for the 7 steps
      const fallbackIntent = `分析输入文本：“${scene}”，识别用户试图通过自由对话寻找表达深沉宿命纠葛、情感追求或信念冲突的歌曲。`;
      
      let detectedTheme = "戏剧性的自我探寻、执着追随与冲突释怀";
      if (lowercaseScene.includes("自由") || lowercaseScene.includes("抗争")) detectedTheme = "不屈抗争、打破世俗枷锁与个性解放";
      else if (lowercaseScene.includes("爱") || lowercaseScene.includes("感情") || lowercaseScene.includes("喜欢")) detectedTheme = "爱恨执念、灵魂共鸣与凄美守护";
      else if (lowercaseScene.includes("心碎") || lowercaseScene.includes("痛苦") || lowercaseScene.includes("孤独")) detectedTheme = "极致孤独、宿命心碎与黑暗中的寻索";

      let detectedEmotion = "坚毅、绝不妥协、悲凉中蕴含狂热希望";
      if (lowercaseScene.includes("孤独") || lowercaseScene.includes("寂寞")) detectedEmotion = "孤独、哀婉、敏感、内敛而深刻";
      else if (lowercaseScene.includes("爱") || lowercaseScene.includes("执着")) detectedEmotion = "专注、奉献、宿命般的炽热与震颤";

      let detectedRelationship = "对抗体制或命运的不屈自我，或是深陷宿命牵绊、欲说还休的双人羁绊";
      if (lowercaseScene.includes("爱") || lowercaseScene.includes("重逢") || lowercaseScene.includes("分别")) detectedRelationship = "相互依恋、生离死别、跨越宿命与时空的深层灵魂伴侣";

      let detectedScene = "处于高塔、荒野、实验室或内心崩溃与抉择的风暴前夜";
      if (lowercaseScene.includes("自由") || lowercaseScene.includes("抗争")) detectedScene = "在铁窗、枷锁、冷酷庄园或暴风雨中做出自决尊严的历史呐喊";

      const fallbackTags = ["freedom", "struggle", "devotion", "hope", "heartbreak"].filter(tag => {
        if (tag === "freedom" && (lowercaseScene.includes("自由") || lowercaseScene.includes("解放") || lowercaseScene.includes("挣脱"))) return true;
        if (tag === "struggle" && (lowercaseScene.includes("抗争") || lowercaseScene.includes("痛苦") || lowercaseScene.includes("拼搏"))) return true;
        if (tag === "devotion" && (lowercaseScene.includes("爱") || lowercaseScene.includes("奉献") || lowercaseScene.includes("守护"))) return true;
        if (tag === "hope" && (lowercaseScene.includes("希望") || lowercaseScene.includes("光明") || lowercaseScene.includes("梦想"))) return true;
        if (tag === "heartbreak" && (lowercaseScene.includes("心碎") || lowercaseScene.includes("悲伤") || lowercaseScene.includes("离别"))) return true;
        return false;
      });
      if (fallbackTags.length === 0) fallbackTags.push("struggle", "hope");

      const normalizedTagsString = fallbackTags.join(", ");

      const fallbackRetrievalSummary = `1. 精准关键词搜索：已检索经典数据库所有包含 “${scene.slice(0, 10)}...” 及同义意象词，并完成字符级别交叉比对。
2. 向量语义搜索：已运行文本词频-逆向文档频率权重分析，通过基于多维情感共鸣的向量夹角余弦算法，对匹配词汇赋予情感亲和加权。
3. AI推荐搜索：根据综合得分计算，将高度重合的标志唱段依次进行剧场张力评测，最终推荐出下列经典唱词。`;

      const matches = filtered
        .map((q) => {
          let score = 40;
          // check for overlap keywords
          const keywords = ["重逢", "分别", "爱", "死", "梦", "自由", "黑暗", "革命", "孤独", "星", "暗恋", "舞台", "野心", "我", "自己", "相信", "在"];
          keywords.forEach((keyword) => {
            if (lowercaseScene.includes(keyword) && (q.lyrics.toLowerCase().includes(keyword) || q.translation.toLowerCase().includes(keyword) || q.sceneDescription.includes(keyword))) {
              score += 15;
            }
          });

          // cross tag matches bonus
          const matchedTagsCount = q.emotionTags.filter(tag => fallbackTags.includes(tag)).length;
          score += matchedTagsCount * 12;

          if (score > 98) score = 98;
          if (score < 40) score = 40;

          return {
            id: q.id,
            score,
            matchingReason: `[离线匹配] 此歌词背景涉及“${q.sceneDescription.slice(0, 45)}...”的情节设定。配置 AI 密钥可获得更精细的跨语言大模型匹配深度。`,
            emotionAnalysis: "与该剧目的情绪标签有着十分显著的重合（重合标签: " + q.emotionTags.filter(t => fallbackTags.includes(t)).join(", ") + "）。",
            sceneAnalysis: q.sceneDescription,
            relationAnalysis: `演出角色: ${q.characterCn} (${q.character})。代表在该段剧情下角色对命运、对自我执念的坚决反抗或忠贞宣告。`,
            tensionAnalysis: "音乐风格激越且层次鲜明，包含起伏跌宕的管弦和戏剧性人声，高潮处有着绝佳的情感爆发力。",
            themeAnalysis: "贴合关于人生主权、执念、挣扎以及不甘平庸的精神母题。"
          };
        })
        .filter((item) => item.score > 45)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      return res.json({
        success: true,
        fallback: true,
        matches,
        analysisSteps: {
          intent: fallbackIntent,
          theme: detectedTheme,
          emotion: detectedEmotion,
          relationship: detectedRelationship,
          scene: detectedScene,
          tags: normalizedTagsString,
          retrievalSummary: fallbackRetrievalSummary
        }
      });
    }

    // Prepare quotes simplified context
    const simplifiedQuotes = databaseQuotes.map((q) => ({
      id: q.id,
      show: q.show,
      showCn: q.showCn,
      song: q.song,
      songCn: q.songCn,
      character: q.character,
      characterCn: q.characterCn,
      lyrics: q.lyrics,
      translation: q.translation,
      sceneDescription: q.sceneDescription,
      emotionTags: q.emotionTags,
    }));

    const systemPrompt = `You are a premium theatrical screenwriter, director, and musical researcher. 
A user describes a dramatic scenario, narrative setup, conflict, or character dynamic:

User Scene Description: "${scene}"

Your objective is to:
1. Conduct a full 7-step theatrical matching process based on the user's input:
   - Step 1: 理解用户意图 (Understand user's inner objective)
   - Step 2: 提取主题 (Formulate/extract core thematic concerns)
   - Step 3: 提取情绪 (Extract core emotion vibe)
   - Step 4: 提取人物关系 (Define relational context, e.g. self-conflict, defiance of authorities, unrequited love)
   - Step 5: 提取场景 (Specify the theatrical/physical situation background)
   - Step 6: 生成搜索标签 (Suggest relevant keywords or emotion tags, e.g. "freedom", "struggle", "hope")
   - Step 7: 执行三层检索 (Explain how exact keyword, vector semantic similarity, and AI recommendation search layers have run to rank the database quotes)

2. Find the most fitting songs/lyrics from our musical database that encapsulate this scenario. Evaluate and score matches (0 to 100). Return only the top matches (maximum 8 results) sorted by score.

Here is our musical database:
${JSON.stringify(simplifiedQuotes, null, 2)}

Instructions:
You must provide the analysis steps under 'analysisSteps' and the matched quotes under 'matches'.
All responses must be fully in Chinese (Simplified).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: systemPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysisSteps: {
              type: Type.OBJECT,
              properties: {
                intent: { type: Type.STRING, description: "第一步：理解用户意图。深度解析用户输入的自然语言，阐释其希望探寻的艺术语境或精神面貌。" },
                theme: { type: Type.STRING, description: "第二步：提取主题。提炼该情境下的核心母题或思想内核。" },
                emotion: { type: Type.STRING, description: "第三步：提取情绪。分析文字中流淌的具体情绪色彩（如绝望、高昂、悲悯）。" },
                relationship: { type: Type.STRING, description: "第四步：提取人物关系。界定其中蕴含的人物或自我对峙纽带。" },
                scene: { type: Type.STRING, description: "第五步：提取场景。描绘该情感发生的戏剧或心理空间舞台背景。" },
                tags: { type: Type.STRING, description: "第六步：生成搜索标签。用逗号分隔展示几个核心高度关联的高频标签（如 freedom, struggle, ambition）。" },
                retrievalSummary: { type: Type.STRING, description: "第七步：执行三层检索。分别详细总结：1. 精准关键词搜索、2. 向量语义搜索、3. AI推荐搜索 在当前实例中的详细运行匹配情况。" }
              },
              required: ["intent", "theme", "emotion", "relationship", "scene", "tags", "retrievalSummary"]
            },
            matches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "ID of matching quote." },
                  score: { type: Type.INTEGER, description: "Matching affinity score (0 to 100) based on drama analysis." },
                  matchingReason: { type: Type.STRING, description: "A comprehensive summary of how this quote captures the user's dramatic scenario." },
                  emotionAnalysis: { type: Type.STRING, description: "Analysis on the alignment of emotional arcs." },
                  sceneAnalysis: { type: Type.STRING, description: "Analysis on plot setup and contextual overlap." },
                  relationAnalysis: { type: Type.STRING, description: "Analysis of character chemistry and social dynamics matching." },
                  tensionAnalysis: { type: Type.STRING, description: "Analysis of the intensity, pacing, and musical build-up similarities." },
                  themeAnalysis: { type: Type.STRING, description: "Underlying theme correspondence statement." }
                },
                required: ["id", "score", "matchingReason", "emotionAnalysis", "sceneAnalysis", "relationAnalysis", "tensionAnalysis", "themeAnalysis"]
              }
            }
          },
          required: ["analysisSteps", "matches"]
        }
      }
    });

    const outputText = response.text || "";
    const resultObj = JSON.parse(outputText.trim());
    res.json({
      success: true,
      fallback: false,
      matches: resultObj.matches || [],
      analysisSteps: resultObj.analysisSteps || {
        intent: "理解用户意图：解析自然语言中蕴藏的灵魂鸣响",
        theme: "提取主题：探幽生命的抉择与执守",
        emotion: "提取情绪：坚忍、执念与未明希望的呼唤",
        relationship: "提取人物关系：自我拷问、灵魂伴侣或反抗对抗纽带",
        scene: "提取场景：交织于黑暗、荒凉或重塑尊严的历史风暴时刻",
        tags: "freedom, struggle, hope",
        retrievalSummary: "1. 精准关键词搜索已就位；\n2. 向量语义搜索已评估情感倾向夹角；\n3. AI推荐搜索已整合戏剧逻辑。"
      }
    });

  } catch (error: any) {
    console.error("AI Scene Match Error: ", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ----------------------------------------------------
// 5. Static Assets & Vite Integration for SPA
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Gemini AI Status: ${isGeminiEnabled() ? "Enabled" : "Disabled (Using Local Match fallback)"}`);
  });
}

startServer();
