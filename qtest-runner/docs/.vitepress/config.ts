import { defineConfig } from 'vitepress'

export default defineConfig({
  appearance: 'dark',
  title: 'qtest-runner',
  description: 'Browser-based test recording and Zephyr Scale test case generation',
  lang: 'ru-RU',
  lastUpdated: true,
  cleanUrls: true,
  ignoreDeadLinks: [
    /^https?:\/\/localhost/,
  ],

  themeConfig: {
    logo: false,

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Architecture', link: '/architecture' },
      { text: 'Usage', link: '/usage' },
      { text: 'Changelog', link: '/changelog' },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'What is qtest-runner', link: '/' },
          { text: 'Usage Guide', link: '/usage' },
          { text: 'Architecture', link: '/architecture' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Execution Flow', link: '/flow' },
          { text: 'Action Types', link: '/action-types' },
          { text: 'Assertions', link: '/assertions' },
          { text: 'Known Problems', link: '/problems' },
          { text: 'Loop Rules', link: '/loop-rules' },
          { text: 'Testing Guide', link: '/testing' },
        ],
      },
      {
        text: 'Project',
        items: [
          { text: 'Status', link: '/status' },
          { text: 'Changelog', link: '/changelog' },
        ],
      },
      {
        text: 'Archive',
        items: [
          { text: 'Refactor Plan', link: '/archive/refactor-plan' },
          { text: 'Gap Analysis', link: '/archive/gap-analysis' },
          { text: 'Playwright Comparison', link: '/archive/playwright-vs-qtestrunner' },
          { text: 'Expanded Plan', link: '/archive/expanded-plan' },
          { text: 'Chat History', link: '/archive/chat-history' },
        ],
      },
    ],

    socialLinks: [],

    footer: {
      message: 'Built with VitePress. Source .md files in <code>qtest-runner/docs/</code>.',
    },

    editLink: {
      pattern: 'https://github.com/anomalyco/qtest-runner/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
})
