import Link from "next/link";
import { Navbar } from "@/components/Navbar";

const sections = [
  {
    title: "产品入口",
    module: "",
    links: [
      { href: "/dashboard", label: "仪表盘", desc: "画像进度、模块结论" },
      { href: "/portrait", label: "职业画像", desc: "AI 对你的理解" },
    ],
  },
  {
    title: "模块零 · 职业辅导",
    module: "Module 0",
    links: [
      { href: "/coaching", label: "辅导报告", desc: "定位、天花板、提升方向" },
    ],
  },
  {
    title: "模块一 · 职业认知",
    module: "Module 1",
    links: [
      { href: "/upload", label: "上传简历", desc: "PDF 拖拽上传" },
      { href: "/parse", label: "确认解析", desc: "AI 提取信息确认" },
      { href: "/diagnosis", label: "快速诊断", desc: "竞争力评级 + 薪资分位" },
      { href: "/dialogue", label: "引导对话", desc: "4-6 轮深度问答" },
      { href: "/roundtable", label: "圆桌讨论", desc: "6 Agent 辩论" },
      { href: "/evaluation", label: "竞争力评估", desc: "5 Agent 评估 + 圆桌共识" },
      { href: "/report/career", label: "认知报告", desc: "完整职业认知报告" },
    ],
  },
  {
    title: "模块二 · 岗位匹配",
    module: "Module 2",
    links: [
      { href: "/match", label: "匹配分析", desc: "JD 输入 + 匹配分析" },
      { href: "/match/report", label: "匹配报告", desc: "4 维度匹配评估" },
      { href: "/match/roundtable", label: "匹配圆桌", desc: "3 角色讨论" },
    ],
  },
  {
    title: "模块三 · 面试辅导",
    module: "Module 3",
    links: [
      { href: "/interview", label: "面试准备", desc: "选岗位 + 轮次" },
      { href: "/interview/session", label: "模拟面试", desc: "AI 逐题提问" },
      { href: "/interview/evaluation", label: "面试评估", desc: "逐题评估 + 示范" },
    ],
  },
  {
    title: "账户",
    module: "",
    links: [
      { href: "/login", label: "登录", desc: "邮箱 + 密码" },
      { href: "/register", label: "注册", desc: "新用户注册" },
      { href: "/reset-password", label: "重置密码", desc: "忘记密码" },
    ],
  },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
            跳不跳
          </h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            AI 驱动的职业决策平台
          </p>
        </div>

      <div className="grid gap-8">
        {sections.map((section) => (
          <section key={section.title}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
                {section.title}
              </h2>
              {section.module && (
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300">
                  {section.module}
                </span>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {section.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:shadow-md transition-shadow"
                >
                  <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {link.label}
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-500 mt-0.5">
                    {link.desc}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
    </main>
  );
}
