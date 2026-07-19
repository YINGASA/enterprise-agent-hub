"use client";

import { StatePanel } from "@/components/ui/StatePanel";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center py-10">
      <StatePanel
        title="页面暂时无法加载"
        description="页面状态未能完整读取。你可以重试；如果问题持续出现，请前往运行监控查看服务状态。"
        tone="danger"
        live="assertive"
        headingLevel={1}
        className="w-full max-w-xl"
        action={<button type="button" onClick={reset} className="app-button-primary">重新加载</button>}
      />
    </div>
  );
}
