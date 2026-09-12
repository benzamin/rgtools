// @ts-check
import preact from '@astrojs/preact';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightThemeBlack from 'starlight-theme-black';

// https://astro.build/config
export default defineConfig({
    site: "https://redgreen.studio",
    //base: "/src",
    trailingSlash: "never",
    build: {
        // Example: Generate `page.html` instead of `page/index.html` during build.
        format: 'file' //https://docs.astro.build/en/reference/configuration-reference/#buildformat
    },
    integrations: [starlight({
        plugins: [
            starlightThemeBlack({
                navLinks: [{ // optional
                    label: 'Docs',
                    link: '/getting-started',
                }],
            }),
      ],
        title: 'My Docs',
        social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/withastro/starlight' }],
        sidebar: [
            {
                label: 'Guides',
                items: [
                    // Each item here is one entry in the navigation menu.
                    { label: 'Example Guide', slug: 'guides/example' },
                ],
            },
            {
                label: 'Reference',
                items: [{ autogenerate: { directory: 'reference' } }],
            },
        ],
		}), preact()],
});