import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // 测试环境
    environment: 'node',

    // 全局 setup
    globals: true,

    // 进程隔离：每个测试文件独立进程，避免环境变量竞态
    pool: 'forks',

    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/lib/**/*.{ts,tsx}'],
      exclude: [
        'src/lib/**/*.d.ts',
        'src/lib/generated/**',
        'src/lib/**/types.ts',
      ],
    },

    // 测试文件匹配模式
    include: [
      'src/**/*.test.{ts,tsx}',
      'src/**/*.spec.{ts,tsx}',
      'tests/**/*.{ts,tsx}',
    ],

    // 排除
    exclude: [
      'node_modules',
      '.next',
      'dist',
    ],

    // Mock 配置
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,

    // 超时
    testTimeout: 10000,
    hookTimeout: 10000,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
