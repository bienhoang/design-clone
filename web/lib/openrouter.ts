interface DOMTreeResult {
  root: any;
  landmarks: any;
  headingTree: any[];
  stats: {
    totalNodes: number;
    maxDepth: number;
    landmarkCount: number;
    pageHeight: number;
    pageWidth: number;
  };
}

function buildPrompt(domTree: DOMTreeResult, url: string) {
  const truncatedRoot = JSON.stringify(domTree.root, null, 2).slice(0, 15000);

  return [
    {
      role: "system" as const,
      content:
        "You are a web design analyst. Analyze the DOM structure and provide a concise Markdown report covering: layout strategy, component hierarchy, responsive patterns, and design system observations. Be specific and actionable.",
    },
    {
      role: "user" as const,
      content: `Analyze this website structure:

URL: ${url}
DOM Stats: ${JSON.stringify(domTree.stats)}
Landmarks: ${JSON.stringify(domTree.landmarks)}
Heading Tree: ${JSON.stringify(domTree.headingTree)}

DOM Tree (depth ${domTree.stats.maxDepth}):
${truncatedRoot}`,
    },
  ];
}

export async function* streamAnalysis(
  domTree: DOMTreeResult,
  url: string
): AsyncGenerator<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey === "your-key-here") {
    yield "[AI analysis skipped: OPENROUTER_API_KEY not set]";
    return;
  }

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-OpenRouter-Title": "Design Clone PoC",
      },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4.5",
        stream: true,
        messages: buildPrompt(domTree, url),
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => "Unknown error");
    yield `[AI analysis failed: ${response.status} ${errText}]`;
    return;
  }

  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    for (const line of value.split("\n")) {
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      try {
        const chunk = JSON.parse(line.slice(6));
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {
        // Skip malformed chunks
      }
    }
  }
}
