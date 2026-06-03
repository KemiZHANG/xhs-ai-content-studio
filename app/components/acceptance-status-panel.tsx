"use client";

import { ShieldCheck } from "lucide-react";
import { buildAcceptanceDeliverySummary, buildAcceptanceStatus } from "@/lib/acceptance/status";

export function AcceptanceStatusPanel() {
  const status = buildAcceptanceStatus();
  const delivery = buildAcceptanceDeliverySummary(status);

  return (
    <section className="settingsGroup acceptanceStatusPanel" aria-label="项目验收状态">
      <div className="acceptanceStatusHeader">
        <div>
          <h3>项目验收状态</h3>
          <p>{delivery.headline}。{status.summary}</p>
        </div>
        <div className="acceptancePercent">
          <ShieldCheck size={18} />
          <strong>{status.completionPercent}%</strong>
          <span>{delivery.stateLabel}</span>
        </div>
      </div>

      <div className="acceptanceStatusGrid">
        <article>
          <span>已由代码和测试覆盖</span>
          <strong>{status.verified.length} 项</strong>
          <p>{delivery.verifiedLine}：{status.verified.slice(0, 3).map((item) => item.label).join("、")} 等。</p>
        </article>
        <article className="warn">
          <span>必须人工确认</span>
          <strong>{status.manualGates.length} 项</strong>
          <p>{delivery.manualGateLine}</p>
        </article>
      </div>

      <article className="acceptanceEvidencePackageCard">
        <span>验收证据包</span>
        <strong>/api/acceptance/evidence-package · v1</strong>
        <p>专用只读接口导出真实发布、定时发布、多账号和生图验收模板；读取它不会调用 MCP、模型、发布或定时任务。</p>
        <div className="acceptanceEvidenceCommands">
          <code>npm run acceptance:evidence-package</code>
          <code>npm run acceptance:validate-evidence</code>
        </div>
      </article>

      <article className="acceptanceEvidencePackageCard">
        <span>完成矩阵</span>
        <strong>/api/acceptance/completion-matrix</strong>
        <p>机器可读的交付矩阵，用于交接、审计和最终验收留档；它列出已验证覆盖、剩余人工闸门、证据字段和安全命令，不会调用 MCP、模型、发布或定时任务。</p>
        <div className="acceptanceEvidenceCommands">
          <code>npm run acceptance:completion-matrix</code>
          <code>data/acceptance-completion-matrix.json</code>
        </div>
      </article>

      <article className="acceptanceValidationRecordCard">
        <span>人工验收记录</span>
        <strong>/api/acceptance/validation-records</strong>
        <p>
          真实发布、定时发布、多账号切换和真实生图完成后，把凭证写入这个本地记录接口；只有所有闸门都有合格记录，项目才会从 99% 变成可证明的 100%。
        </p>
        <div className="acceptanceValidationProgress" aria-label="人工验收记录进度">
          <span>已验证 {status.validatedManualGateIds.length}</span>
          <span>待验证 {status.pendingManualGateIds.length}</span>
        </div>
        <div className="acceptanceEvidenceCommands">
          <code>npm run acceptance:record-evidence</code>
          <code>npm run acceptance:export-records</code>
          <code>data/acceptance-validation-records-export.json</code>
        </div>
      </article>

      <details className="acceptanceStatusDetails">
        <summary>查看外部验收闸门和安全命令</summary>
        <div className="acceptanceGateList">
          {status.manualGates.map((gate) => (
            <article key={gate.id}>
              <em className={status.validatedManualGateIds.includes(gate.id) ? "acceptanceGateState done" : "acceptanceGateState pending"}>
                {status.validatedManualGateIds.includes(gate.id) ? "已记录验收" : "等待人工验收记录"}
              </em>
              <strong>{gate.label}</strong>
              <p>{gate.reason}</p>
              <small>
                指南：{gate.guide} · 第一步：{gate.firstSafeStep}
              </small>
              <small>
                完成证据：{gate.proofRequired} · {gate.canBeAutomated ? "可自动验收" : "必须人工验收"}
              </small>
              <ol className="acceptanceChecklist">
                {gate.checklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
              <div className="acceptanceEvidenceFields" aria-label={`${gate.label} 证据字段`}>
                <span>证据字段</span>
                {gate.evidenceFields.map((field) => (
                  <code key={field.key}>
                    {field.label}{field.required ? " *" : ""}: {field.example}
                  </code>
                ))}
              </div>
            </article>
          ))}
        </div>
        <div className="acceptanceCommandList">
          {status.recommendedCommands.map((command) => (
            <code key={command}>{command}</code>
          ))}
        </div>
        <p className="acceptanceNextCommand">下一步安全命令：<code>{delivery.nextSafeCommand}</code></p>
      </details>
    </section>
  );
}

export function AcceptanceStatusCompactPanel() {
  const status = buildAcceptanceStatus();
  const delivery = buildAcceptanceDeliverySummary(status);

  return (
    <section className="acceptanceCompactPanel" aria-label="交付验收摘要">
      <div>
        <span>交付状态</span>
        <strong>{delivery.completionLine} · {delivery.stateLabel}</strong>
        <p>{delivery.manualGateLine}</p>
      </div>
      <code>{delivery.nextSafeCommand}</code>
    </section>
  );
}
