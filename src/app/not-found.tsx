import Link from "next/link";
import { StatePanel } from "@/components/ui/StatePanel";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center py-10">
      <StatePanel
        title="页面不存在"
        description="该地址没有对应的工作台页面，可能已被移动或输入有误。"
        tone="warning"
        headingLevel={1}
        className="w-full max-w-xl"
        action={<Link href="/" className="app-button-primary">返回首页</Link>}
      />
    </div>
  );
}
