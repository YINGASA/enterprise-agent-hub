import { StatePanel } from "@/components/ui/StatePanel";

export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-10" aria-busy="true">
      <StatePanel title="正在加载工作台" description="正在读取页面与当前工作区状态，请稍候。" tone="info" headingLevel={1} className="w-full max-w-xl" />
    </div>
  );
}
