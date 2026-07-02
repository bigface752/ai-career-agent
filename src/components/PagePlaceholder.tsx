import Link from "next/link";

interface PagePlaceholderProps {
  title: string;
  description: string;
  module?: string;
}

export function PagePlaceholder({
  title,
  description,
  module,
}: PagePlaceholderProps) {
  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <nav className="mb-6">
        <Link
          href="/"
          className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
        >
          ← 返回首页
        </Link>
      </nav>

      {module && (
        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 mb-3">
          {module}
        </span>
      )}

      <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
        {title}
      </h1>
      <p className="text-neutral-600 dark:text-neutral-400">{description}</p>

      <div className="mt-8 p-6 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900">
        <p className="text-sm text-neutral-500 dark:text-neutral-500 text-center">
          页面开发中…
        </p>
      </div>
    </main>
  );
}
