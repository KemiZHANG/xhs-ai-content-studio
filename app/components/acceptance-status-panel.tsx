"use client";

import { ShieldCheck } from "lucide-react";
import { buildAcceptanceStatus } from "@/lib/acceptance/status";

export function AcceptanceStatusPanel() {
  const status = buildAcceptanceStatus();
  const manualLabels = status.manualGates.map((gate) => gate.label).join("、");

  return (
    <section className="settingsGroup acceptanceStatusPanel" aria-label="项目验收状态">
      <div className="acceptanceStatusHeader">
        <div>
          <h3>项目验收状态</h3>
          <p>{status.summary}</p>
        </div>
        <div className="acceptancePercent">
          <ShieldCheck size={18} />
          <strong>{status.completionPercent}%</strong>
          <span>{status.canMarkComplete ? "可标记完成" : "仍需外部验收"}</span>
        </div>
      </div>

      <div className="acceptanceStatusGrid">
        <article>
          <span>已由代码和测试覆盖</span>
          <strong>{status.verified.length} 项</strong>
          <p>{status.verified.slice(0, 3).map((item) => item.label).join("、")} 等。</p>
        </article>
        <article className="warn">
          <span>必须人工确认</span>
          <strong>{status.manualGates.length} 项</strong>
          <p>{manualLabels}</p>
        </article>
      </div>

      <details className="acceptanceStatusDetails">
        <summary>查看外部验收闸门和安全命令</summary>
        <div className="acceptanceGateList">
          {status.manualGates.map((gate) => (
            <article key={gate.id}>
              <strong>{gate.label}</strong>
              <p>{gate.reason}</p>
              <small>
                指南：{gate.guide} · 第一步：{gate.firstSafeStep}
              </small>
            </article>
          ))}
        </div>
        <div className="acceptanceCommandList">
          {status.recommendedCommands.map((command) => (
            <code key={command}>{command}</code>
          ))}
        </div>
      </details>
    </section>
  );
}

