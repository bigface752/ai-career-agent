"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { InterviewSetupStep } from "@/components/interview/InterviewSetupStep";
import type { GenerateQuestionsResponse } from "@/lib/interview/schema";

export default function InterviewPage() {
  const router = useRouter();

  const handleStart = useCallback(
    (data: GenerateQuestionsResponse) => {
      // 将 interview_id 和题目数据传到 session 页面
      // 通过 URL 参数 + sessionStorage 传递
      sessionStorage.setItem(
        `interview_${data.interview_id}`,
        JSON.stringify(data)
      );
      router.push(`/interview/session?interview_id=${data.interview_id}`);
    },
    [router]
  );

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <Navbar badge="模块三 · 面试辅导" />
      <InterviewSetupStep onStart={handleStart} />
    </div>
  );
}
