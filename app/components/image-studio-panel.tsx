"use client";

import { ImagePlus, Sparkles, Upload } from "lucide-react";
import type { ClipboardEvent, DragEvent } from "react";
import type { AssetRecord, CardPaginationMode, CardTheme, ImageStudioMode } from "@/app/types";

export function ImageStudioPanel({
  assets,
  selectedIds,
  assetForm,
  cardForm,
  mode,
  busy,
  evidenceContext,
  onAssetFormChange,
  onCardFormChange,
  onModeChange,
  onUploadFiles,
  onGenerate,
  onGenerateCards,
  onToggleSelect,
  onGoChat,
  onOpenPublish
}: {
  assets: AssetRecord[];
  selectedIds: string[];
  assetForm: {
    productName: string;
    sellingPoints: string;
    scene: string;
    style: string;
    extraPrompt: string;
  };
  cardForm: {
    title: string;
    subtitle: string;
    body: string;
    tagsText: string;
    theme: CardTheme;
    mode: CardPaginationMode;
    width: number;
    height: number;
  };
  mode: ImageStudioMode;
  busy: string | null;
  evidenceContext: string;
  onAssetFormChange: (next: typeof assetForm) => void;
  onCardFormChange: (next: typeof cardForm) => void;
  onModeChange: (next: ImageStudioMode) => void;
  onUploadFiles: (files: FileList | File[]) => void;
  onGenerate: () => void;
  onGenerateCards: () => void;
  onToggleSelect: (id: string) => void;
  onGoChat: () => void;
  onOpenPublish: () => void;
}) {
  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (event.dataTransfer.files.length) {
      onUploadFiles(event.dataTransfer.files);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLElement>) {
    if (event.clipboardData.files.length) {
      onUploadFiles(event.clipboardData.files);
    }
  }

  const selectedAssets = assets.filter((asset) => selectedIds.includes(asset.id));

  return (
    <div className="twoColumn wideLeft">
      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2>图片创作台</h2>
            <p>这里专门生成要随笔记发布的图片。可以 AI 生图，也可以稳定生成小红书图文卡片。</p>
          </div>
        </div>

        <div className="segmentedControl" aria-label="图片创作模式">
          <button className={mode === "ai" ? "active" : ""} onClick={() => onModeChange("ai")} type="button">
            AI 生图
          </button>
          <button className={mode === "card" ? "active" : ""} onClick={() => onModeChange("card")} type="button">
            图文卡片
          </button>
        </div>

        {mode === "ai" ? (
          <>
            <div
              className="imageStudioDrop"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              onPaste={handlePaste}
              tabIndex={0}
            >
              <ImagePlus size={24} />
              <strong>拖入或粘贴产品图/参考图</strong>
              <span>上传后会进入产品素材库，并自动选入本次生成。没有参考图也可以直接生成。</span>
              <label className="secondaryButton attachmentButton">
                <Upload size={16} />
                上传图片
                <input
                  accept="image/*"
                  multiple
                  type="file"
                  onChange={(event) => {
                    if (event.target.files?.length) onUploadFiles(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            <div className="formStack imageStudioForm">
              <div className="formRow">
                <label>
                  <span>产品/对象名称</span>
                  <input value={assetForm.productName} onChange={(event) => onAssetFormChange({ ...assetForm, productName: event.target.value })} />
                </label>
                <label>
                  <span>卖点/内容要点</span>
                  <input value={assetForm.sellingPoints} onChange={(event) => onAssetFormChange({ ...assetForm, sellingPoints: event.target.value })} />
                </label>
              </div>
              <div className="formRow">
                <label>
                  <span>生成场景</span>
                  <input value={assetForm.scene} onChange={(event) => onAssetFormChange({ ...assetForm, scene: event.target.value })} />
                </label>
                <label>
                  <span>图片风格</span>
                  <input value={assetForm.style} onChange={(event) => onAssetFormChange({ ...assetForm, style: event.target.value })} />
                </label>
              </div>
              <label>
                <span>补充要求</span>
                <textarea
                  value={assetForm.extraPrompt}
                  onChange={(event) => onAssetFormChange({ ...assetForm, extraPrompt: event.target.value })}
                  placeholder="例如：生成首图封面，保留产品瓶身，背景换成广州咖啡馆窗边桌面，真实自然光。"
                />
              </label>
            </div>
          </>
        ) : (
          <div className="formStack imageStudioForm cardStudioForm">
            <label>
              <span>卡片标题</span>
              <input
                value={cardForm.title}
                onChange={(event) => onCardFormChange({ ...cardForm, title: event.target.value })}
                placeholder="例如：广州咖啡馆一周收藏趋势"
              />
            </label>
            <label>
              <span>副标题</span>
              <input
                value={cardForm.subtitle}
                onChange={(event) => onCardFormChange({ ...cardForm, subtitle: event.target.value })}
                placeholder="例如：适合周末探店账号的选题拆解"
              />
            </label>
            <div className="formRow">
              <label>
                <span>主题风格</span>
                <select value={cardForm.theme} onChange={(event) => onCardFormChange({ ...cardForm, theme: event.target.value as CardTheme })}>
                  <option value="sketch">手绘草稿风</option>
                  <option value="professional">专业蓝白风</option>
                  <option value="retro">复古杂志风</option>
                  <option value="terminal">终端黑绿风</option>
                  <option value="botanical">自然植物风</option>
                  <option value="neo-brutalism">新粗野主义</option>
                  <option value="playful-geometric">几何活泼风</option>
                  <option value="default">极简默认风</option>
                </select>
              </label>
              <label>
                <span>分页模式</span>
                <select value={cardForm.mode} onChange={(event) => onCardFormChange({ ...cardForm, mode: event.target.value as CardPaginationMode })}>
                  <option value="auto-split">自动拆页</option>
                  <option value="auto-fit">自动缩放到一页</option>
                  <option value="separator">手动分页：用 --- 分隔</option>
                  <option value="dynamic">动态长文分页</option>
                </select>
              </label>
            </div>
            <div className="formRow">
              <label>
                <span>宽度</span>
                <input
                  type="number"
                  value={cardForm.width}
                  onChange={(event) => onCardFormChange({ ...cardForm, width: Number(event.target.value) })}
                />
              </label>
              <label>
                <span>高度</span>
                <input
                  type="number"
                  value={cardForm.height}
                  onChange={(event) => onCardFormChange({ ...cardForm, height: Number(event.target.value) })}
                />
              </label>
            </div>
            <label>
              <span>卡片正文</span>
              <textarea
                value={cardForm.body}
                onChange={(event) => onCardFormChange({ ...cardForm, body: event.target.value })}
                placeholder={"如果选择手动分页，可以用 --- 分隔每一张正文卡片。留空时会尝试使用当前草稿正文。"}
              />
            </label>
            <label>
              <span>标签</span>
              <input
                value={cardForm.tagsText}
                onChange={(event) => onCardFormChange({ ...cardForm, tagsText: event.target.value })}
                placeholder="#广州咖啡 #探店 #周末去哪儿"
              />
            </label>
          </div>
        )}

        <section className="resultBlock evidenceCarryBlock">
          <h3>已携带研究证据</h3>
          <p>{evidenceContext || "还没有研究证据。你仍然可以仅根据文字和参考图生成图片。"}</p>
        </section>

        <div className="actionRow">
          <button
            className="primaryButton"
            disabled={busy === "asset-generate" || busy === "card-generate"}
            onClick={mode === "ai" ? onGenerate : onGenerateCards}
            type="button"
          >
            <Sparkles size={16} />
            {busy === "asset-generate" || busy === "card-generate"
              ? "生成中"
              : mode === "card"
                ? "生成图文卡片"
                : selectedIds.length
                  ? "基于选中图片生成"
                  : "无参考图直接生成"}
          </button>
          <button className="secondaryButton" onClick={onGoChat} type="button">
            回到文案对话
          </button>
          <button className="secondaryButton" onClick={onOpenPublish} type="button">
            进入发布装配台
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader compact">
          <h2>本次参考图</h2>
        </div>
        {selectedAssets.length ? (
          <div className="attachedAssetStrip large">
            {selectedAssets.map((asset) => (
              <span key={asset.id}>
                <img alt={asset.name} src={`/api/assets/file/${asset.id}`} />
                {asset.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="muted">未选择参考图，将按文字和研究证据直接生成。</p>
        )}

        <div className="divider" />
        <div className="panelHeader compact">
          <h2>产品素材 / 参考图 / 生成结果</h2>
        </div>
        <div className="assetGrid compactAssets">
          {assets.length ? (
            assets.map((asset) => (
              <article className={selectedIds.includes(asset.id) ? "assetCard selected" : "assetCard"} key={asset.id}>
                <button className="assetImageButton" onClick={() => onToggleSelect(asset.id)} type="button">
                  <img alt={asset.name} src={`/api/assets/file/${asset.id}`} />
                </button>
                <div>
                  <strong>{asset.name}</strong>
                  <span>{asset.kind === "generated" ? "生成结果" : "产品/参考图"}</span>
                </div>
              </article>
            ))
          ) : (
            <p className="muted">还没有素材。可以直接拖图到左侧上传。</p>
          )}
        </div>
      </section>
    </div>
  );
}
