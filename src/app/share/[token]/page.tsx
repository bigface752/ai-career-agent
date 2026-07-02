/**
 * 公开分享页面
 * 无需登录，根据 token 查找报告并渲染
 */
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SharedReportViewer } from "@/components/report/SharedReportViewer";

interface SharePageProps {
  params: { token: string };
}

export async function generateMetadata({
  params,
}: SharePageProps): Promise<Metadata> {
  const titles: Record<string, string> = {
    career: "职业认知报告",
    match: "岗位匹配分析",
    interview: "面试评估报告",
  };

  try {
    const report = await db.report.findUnique({
      where: { shareToken: params.token },
      select: { module: true },
    });

    if (!report) {
      return { title: "分享链接已失效" };
    }

    return {
      title: `${titles[report.module] || "分析报告"} - AI 职业智囊`,
      description: "由 AI 职业智囊生成的智能分析报告",
      robots: { index: false, follow: false },
    };
  } catch {
    return { title: "AI 职业智囊" };
  }
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = params;

  // 1. 查找报告（只查 shareToken 匹配且未被撤销的）
  let report;
  try {
    report = await db.report.findUnique({
      where: { shareToken: token },
      select: {
        id: true,
        module: true,
        reportType: true,
        content: true,
        createdAt: true,
      },
    });
  } catch {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-6xl">⚠️</p>
          <h1 className="text-xl font-bold text-neutral-800 dark:text-neutral-200">
            加载失败
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            数据库连接异常，请稍后重试
          </p>
        </div>
      </div>
    );
  }

  if (!report) {
    notFound();
  }

  // 2. 解析内容
  let content: unknown;
  try {
    content = JSON.parse(report.content);
  } catch {
    // content 可能是纯 HTML
    content = report.content;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      {/* 顶部品牌栏 */}
      <header className="border-b border-neutral-200 dark:border-neutral-800 py-3 px-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            AI 职业智囊
          </span>
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            {new Date(report.createdAt).toLocaleDateString("zh-CN")}
          </span>
        </div>
      </header>

      {/* 报告内容 */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        <SharedReportViewer
          module={report.module}
          reportType={report.reportType}
          content={content}
        />
      </main>

      {/* 底部 */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 py-4 px-4">
        <p className="text-center text-xs text-neutral-400 dark:text-neutral-500">
          本报告由 AI 职业智囊生成，仅供参考 ·
          <a href="/" className="text-primary-500 hover:text-primary-600 ml-1">
            开始你的职业分析
          </a>
        </p>
      </footer>
    </div>
  );
}
