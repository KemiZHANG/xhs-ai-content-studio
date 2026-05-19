import { describe, expect, it } from "vitest";
import { buildSampleEvidence, collectImageUrls, runOneClickWorkflow } from "@/lib/workflows/one-click";
import { defaultSettings } from "@/lib/storage/settings";

describe("runOneClickWorkflow", () => {
  it("extracts image urls from JSON detail text without treating the JSON blob or avatars as evidence images", () => {
    const detailText = JSON.stringify({
      data: {
        note: {
          desc: "A real note body.",
          user: {
            avatar: "https://sns-avatar-qc.xhscdn.com/avatar/user.jpg"
          },
          imageList: [
            {
              urlDefault:
                "http://sns-webpic-qc.xhscdn.com/20260518/sample-a/notes_pre_post/image-a!nd_dft_wlteh_webp_3",
              urlPre:
                "http://sns-webpic-qc.xhscdn.com/20260518/sample-b/notes_pre_post/image-b!nd_prv_wlteh_webp_3"
            }
          ]
        }
      }
    });

    const urls = collectImageUrls([{ content: [{ type: "text", text: detailText }] }], []);

    expect(urls).toContain(
      "http://sns-webpic-qc.xhscdn.com/20260518/sample-a/notes_pre_post/image-a!nd_dft_wlteh_webp_3"
    );
    expect(urls).toContain(
      "http://sns-webpic-qc.xhscdn.com/20260518/sample-b/notes_pre_post/image-b!nd_prv_wlteh_webp_3"
    );
    expect(urls).not.toContain(detailText);
    expect(urls.some((url) => url.includes("sns-avatar"))).toBe(false);
  });

  it("does not treat MCP detail failure messages as note body text", () => {
    const evidence = buildSampleEvidence(
      [
        {
          id: "note-failed-detail",
          title: "Coffee shop note",
          likes: 10,
          collects: 8,
          comments: 2,
          shares: 1,
          xsecToken: "token",
          author: "author",
          url: "",
          imageUrls: [],
          raw: {
            noteCard: {
              displayTitle: "Coffee shop note"
            }
          },
          score: 0
        }
      ],
      [
        {
          content: [
            {
              type: "text",
              text: "获取Feed详情失败: feed note-failed-detail not found in noteDetailMap"
            }
          ]
        }
      ]
    );

    expect(evidence[0].detailText).toBe("");
    expect(evidence[0].reasonHighlights.some((item) => item.includes("已获取正文"))).toBe(false);
  });

  it("keeps detail evidence when image style analysis fails in research mode", async () => {
    const result = await runOneClickWorkflow({
      input: {
        topic: "广州咖啡馆",
        contentType: "探店",
        timeRange: "一周内",
        sampleCount: 1,
        visibility: defaultSettings.defaultVisibility,
        publishMode: "draft",
        workflowGoal: "research",
        analyzeImages: true,
        generateImages: false
      },
      settings: {
        ...defaultSettings,
        textApiKey: "text-key"
      },
      mcp: {
        searchFeeds: async () => [
          {
            id: "note-detail",
            xsecToken: "token-detail",
            noteCard: {
              displayTitle: "广州玻璃房咖啡馆",
              user: { nickname: "探店人" },
              interactInfo: { likedCount: "100", collectedCount: "80", commentCount: "9" },
              cover: { urlDefault: "http://sns-webpic-qc.xhscdn.com/detail.webp" }
            }
          }
        ],
        getFeedDetail: async () => ({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                data: {
                  note: {
                    desc: "正文写了窗边座位、湖边景观、人均价格和适合办公的时间段。"
                  },
                  comments: [{ content: "求地址" }]
                }
              })
            }
          ]
        }),
        publishContent: async () => ({ ok: true })
      },
      model: {
        analyzeImageStyle: async () => {
          throw new Error("Image style analysis failed with HTTP 500");
        },
        generateStructuredText: async () =>
          JSON.stringify({
            report: "研究总结仍然可用。",
            researchSummary: {
              contentStrengths: ["正文提供了价格、座位和时间段。"],
              imageStrengths: ["图片可参考窗边和湖景。"],
              learningsForContent: ["写清楚适合谁、什么时候去。"],
              learningsForImages: ["保留空间纵深和自然光。"],
              nextQuestions: ["要宣传哪家店？"]
            }
          }),
        generateImageFromReference: async () => null,
        generateImage: async () => null
      }
    });

    expect(result.status).toBe("research_ready");
    expect(result.evidence[0].detailText).toContain("窗边座位");
    expect(result.evidence[0].commentSnippets).toContain("求地址");
    expect(result.imageStyleReport).toBe("");
    expect(result.steps).toContainEqual(
      expect.objectContaining({
        id: "image-style",
        status: "skipped"
      })
    );
  });

  it("runs research mode without generating a draft or publishing", async () => {
    let modelCalls = 0;
    let publishCalls = 0;

    const result = await runOneClickWorkflow({
      input: {
        topic: "广州咖啡馆",
        contentType: "探店",
        timeRange: "一周内",
        sampleCount: 1,
        visibility: defaultSettings.defaultVisibility,
        publishMode: "draft",
        workflowGoal: "research",
        analyzeImages: true,
        generateImages: true
      },
      settings: {
        ...defaultSettings,
        textApiKey: "text-key",
        imageApiKey: "image-key"
      },
      mcp: {
        searchFeeds: async () => [
          {
            id: "note-research",
            xsecToken: "token-research",
            noteCard: {
              displayTitle: "广州咖啡馆真实样本",
              user: { nickname: "探店人" },
              interactInfo: { likedCount: "100", collectedCount: "80", commentCount: "9" },
              cover: { urlDefault: "http://sns-webpic-qc.xhscdn.com/research.webp" }
            }
          }
        ],
        getFeedDetail: async () => ({
          note: { desc: "正文写了窗边座位、价格和路线。" },
          comments: [{ content: "求地址" }]
        }),
        publishContent: async () => {
          publishCalls += 1;
          return { ok: true };
        }
      },
      model: {
        generateStructuredText: async () => {
          modelCalls += 1;
          return JSON.stringify({
            report: "样本强调窗边座位、价格和路线，适合先做证据分析。",
            researchSummary: {
              contentStrengths: ["标题有明确地点和情绪"],
              imageStrengths: ["窗边自然光形成记忆点"],
              learningsForContent: ["正文先写真实体验，再给路线价格"],
              learningsForImages: ["优先拍窗边、桌面、饮品三层关系"],
              nextQuestions: ["你要宣传哪家店，主打安静办公还是约会氛围？"]
            }
          });
        },
        analyzeImageStyle: async () => "图片偏自然光、窗边构图。",
        generateImageFromReference: async () => ({ path: "C:\\tmp\\should-not-create.png" }),
        generateImage: async () => ({ path: "C:\\tmp\\should-not-create.png" })
      }
    });

    expect(result.status).toBe("research_ready");
    expect(result.draft).toBeNull();
    expect(result.images).toEqual([]);
    expect(result.researchSummary?.contentStrengths).toContain("标题有明确地点和情绪");
    expect(result.steps.some((step) => step.id === "generate-draft")).toBe(false);
    expect(modelCalls).toBe(1);
    expect(publishCalls).toBe(0);
  });

  it("extracts note正文 and comments from JSON text returned by MCP detail tools", () => {
    const evidence = buildSampleEvidence(
      [
        {
          id: "note-json-detail",
          title: "样本标题",
          likes: 10,
          collects: 20,
          comments: 3,
          shares: 1,
          score: 0
        }
      ],
      [
        {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                data: {
                  noteDetail: {
                    note: {
                      desc: "这是一段完整正文，包含具体价格和路线。"
                    }
                  },
                  comment_list: [
                    { content: "求具体地址" },
                    { content: "这家人多吗" }
                  ]
                }
              })
            }
          ]
        }
      ]
    );

    expect(evidence[0].detailText).toBe("这是一段完整正文，包含具体价格和路线。");
    expect(evidence[0].commentSnippets).toContain("求具体地址");
    expect(evidence[0].commentSnippets).toContain("这家人多吗");
  });

  it("returns a setup-required result when no text model key is configured", async () => {
    const result = await runOneClickWorkflow({
      input: {
        topic: "上海安静咖啡馆",
        contentType: "探店",
        timeRange: "一周内",
        sampleCount: 5,
        visibility: "仅自己可见",
        autoPublish: false,
        publishMode: "draft",
        analyzeImages: false,
        generateImages: false
      },
      settings: defaultSettings,
      mcp: {
        searchFeeds: async () => [],
        getFeedDetail: async () => null,
        publishContent: async () => ({ skipped: true })
      },
      model: {
        generateStructuredText: async () => {
          throw new Error("model should not be called without key");
        },
        analyzeImageStyle: async () => "",
        generateImageFromReference: async () => null,
        generateImage: async () => null
      }
    });

    expect(result.status).toBe("needs_settings");
    expect(result.steps.some((step) => step.id === "model-settings")).toBe(true);
    expect(result.publishResult).toEqual({ skipped: true });
  });

  it("keeps draft mode from generating images or publishing", async () => {
    let imageCalls = 0;
    let publishCalls = 0;

    const result = await runOneClickWorkflow({
      input: {
        topic: "通勤包",
        contentType: "种草",
        timeRange: "一周内",
        sampleCount: 3,
        visibility: "仅自己可见",
        autoPublish: false,
        publishMode: "draft",
        analyzeImages: false,
        generateImages: false
      },
      settings: {
        ...defaultSettings,
        textApiKey: "text-key",
        imageApiKey: "image-key"
      },
      mcp: {
        searchFeeds: async () => [
          { id: "a", title: "通勤包怎么选", likes: 10, collects: 20, comments: 3 }
        ],
        getFeedDetail: async () => null,
        publishContent: async () => {
          publishCalls += 1;
          return { ok: true };
        }
      },
      model: {
        generateStructuredText: async () =>
          JSON.stringify({
            report: "标题强调场景，正文突出容量和通勤痛点。",
            draft: {
              title: "通勤包这样选",
              content: "原创正文",
              tags: ["通勤包"],
              structure: ["痛点", "选择标准", "互动"],
              imagePrompt: "通勤包平铺图"
            }
          }),
        analyzeImageStyle: async () => "干净背景，真实通勤场景",
        generateImageFromReference: async () => ({ path: "C:\\tmp\\image.png" }),
        generateImage: async () => {
          imageCalls += 1;
          return { path: "C:\\tmp\\image.png" };
        }
      }
    });

    expect(result.status).toBe("draft_ready");
    expect(result.draft?.title).toBe("通勤包这样选");
    expect(result.images).toEqual([]);
    expect(imageCalls).toBe(0);
    expect(publishCalls).toBe(0);
  });

  it("normalizes nested Xiaohongshu noteCard search result fields", async () => {
    const result = await runOneClickWorkflow({
      input: {
        topic: "coffee",
        contentType: "visit",
        timeRange: "week",
        sampleCount: 1,
        visibility: defaultSettings.defaultVisibility,
        autoPublish: false,
        publishMode: "draft",
        analyzeImages: false,
        generateImages: false
      },
      settings: {
        ...defaultSettings,
        textApiKey: "text-key"
      },
      mcp: {
        searchFeeds: async () => [
          {
            id: "note-1",
            xsecToken: "token-1",
            noteCard: {
              displayTitle: "Hidden Garden Coffee",
              user: {
                nickname: "Cafe Hunter"
              },
              interactInfo: {
                likedCount: "12",
                collectedCount: "7",
                commentCount: "3",
                sharedCount: "2"
              },
              cover: {
                urlDefault: "http://sns-webpic-qc.xhscdn.com/example.webp"
              }
            }
          }
        ],
        getFeedDetail: async () => null,
        publishContent: async () => ({ skipped: true })
      },
      model: {
        generateStructuredText: async () =>
          JSON.stringify({
            report: "report",
            draft: {
              title: "Coffee note",
              content: "content",
              tags: ["coffee"],
              structure: ["hook"],
              imagePrompt: "photo"
            }
          }),
        analyzeImageStyle: async () => "",
        generateImageFromReference: async () => null,
        generateImage: async () => null
      }
    });

    expect(result.samples[0]).toMatchObject({
      title: "Hidden Garden Coffee",
      author: "Cafe Hunter",
      likes: 12,
      collects: 7,
      comments: 3,
      shares: 2
    });
    expect(result.samples[0].score).toBeGreaterThan(0);
    expect(result.samples[0].imageUrls).toContain("http://sns-webpic-qc.xhscdn.com/example.webp");
  });

  it("returns evidence cards with metrics, images, and tokenized source links", async () => {
    const result = await runOneClickWorkflow({
      input: {
        topic: "广州咖啡馆",
        contentType: "探店",
        timeRange: "一周内",
        sampleCount: 1,
        visibility: defaultSettings.defaultVisibility,
        autoPublish: false,
        publishMode: "draft",
        analyzeImages: false,
        generateImages: false
      },
      settings: {
        ...defaultSettings,
        textApiKey: "text-key"
      },
      mcp: {
        searchFeeds: async () => [
          {
            id: "note-2",
            xsecToken: "abc token",
            noteCard: {
              displayTitle: "公园里的咖啡馆",
              user: { nickname: "探店博主" },
              interactInfo: {
                likedCount: "100",
                collectedCount: "80",
                commentCount: "12",
                sharedCount: "5"
              },
              cover: {
                urlDefault: "http://sns-webpic-qc.xhscdn.com/coffee.webp"
              }
            }
          }
        ],
        getFeedDetail: async () => ({
          content: [{ text: "正文提到窗边座位、绿植、公园路线和人均价格。" }],
          comments: [{ content: "求地址" }, { content: "停车方便吗" }]
        }),
        publishContent: async () => ({ skipped: true })
      },
      model: {
        generateStructuredText: async () =>
          JSON.stringify({
            report: "样本1收藏高，因为标题清楚、场景有画面感，并提供路线信息。",
            draft: {
              title: "公园咖啡馆",
              content: "原创正文",
              tags: ["广州咖啡馆"],
              structure: ["证据", "分析", "草稿"],
              imagePrompt: "窗边咖啡"
            }
          }),
        analyzeImageStyle: async () => "",
        generateImageFromReference: async () => null,
        generateImage: async () => null
      }
    });

    expect(result.evidence[0]).toMatchObject({
      id: "note-2",
      title: "公园里的咖啡馆",
      author: "探店博主",
      likes: 100,
      collects: 80,
      comments: 12,
      shares: 5
    });
    expect(result.evidence[0].url).toContain("xsec_token=abc%20token");
    expect(result.evidence[0].imageUrls).toContain("http://sns-webpic-qc.xhscdn.com/coffee.webp");
    expect(result.evidence[0].cachedImageUrls).toEqual([]);
    expect(result.evidence[0].detailText).toContain("窗边座位");
    expect(result.evidence[0].commentSnippets).toContain("求地址");
    expect(result.evidence[0].reasonHighlights.length).toBeGreaterThan(0);
  });

  it("passes schedule time when schedule mode publishes", async () => {
    let publishArgs: unknown = null;

    const result = await runOneClickWorkflow({
      input: {
        topic: "低成本卧室改造",
        contentType: "干货",
        timeRange: "一周内",
        sampleCount: 3,
        visibility: "仅自己可见",
        autoPublish: true,
        publishMode: "schedule",
        analyzeImages: false,
        generateImages: true,
        scheduleAt: "2026-05-19T20:00:00+08:00"
      },
      settings: {
        ...defaultSettings,
        textApiKey: "text-key",
        imageApiKey: "image-key"
      },
      mcp: {
        searchFeeds: async () => [
          { id: "a", title: "卧室改造", likes: 100, collects: 80, comments: 12 }
        ],
        getFeedDetail: async () => null,
        publishContent: async (args) => {
          publishArgs = args;
          return { ok: true };
        }
      },
      model: {
        generateStructuredText: async () =>
          JSON.stringify({
            report: "高收藏内容强调前后对比和清单。",
            draft: {
              title: "卧室改造清单",
              content: "原创正文",
              tags: ["卧室改造"],
              structure: ["前后对比", "清单", "预算"],
              imagePrompt: "卧室改造前后对比"
            }
          }),
        analyzeImageStyle: async () => "",
        generateImageFromReference: async () => ({ path: "C:\\tmp\\bedroom.png" }),
        generateImage: async () => ({ path: "C:\\tmp\\bedroom.png" })
      }
    });

    expect(result.status).toBe("scheduled");
    expect(publishArgs).toMatchObject({
      scheduleAt: "2026-05-19T20:00:00+08:00"
    });
  });
});
