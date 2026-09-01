// End-to-end test for `cn build`: scan a fixture project, emit tables,
// verify subset parity for in-corpus classes and passthrough for the rest.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { twMerge as ref } from 'tailwind-merge'

const bin = fileURLToPath(new URL('../../cn/bin/cn.mjs', import.meta.url))
const dir = mkdtempSync(join(tmpdir(), 'cn-cli-'))
let pass = 0
let fail = 0
const expect = (label, cond, detail = '') => {
    if (cond) pass++
    else {
        fail++
        console.log(`CLI FAIL [${label}] ${detail}`)
    }
}

try {
    // ---- fixture project -----------------------------------------------------
    writeFileSync(
        join(dir, 'Button.tsx'),
        `export const Button = ({ active }) => (
            <button className={cn(
                "inline-flex items-center rounded-md px-3 py-2 text-sm font-medium",
                active && "bg-primary text-primary-foreground hover:bg-primary/90",
                "px-4 p-2 text-lg/7 leading-6 -mt-2 w-[13px]"
            )}>x</button>
        )`,
    )
    writeFileSync(
        join(dir, 'card.html'),
        `<div class="border border-input shadow-sm data-[state=open]:p-2 md:hover:text-red-500"></div>`,
    )
    writeFileSync(join(dir, 'safelist.txt'), 'columns-2 columns-3\n')
    writeFileSync(
        join(dir, 'cn.config.mjs'),
        `export default { extend: { classGroups: { "font-size": [{ text: ["hero"] }] } } }\n`,
    )

    // ---- subset build ----------------------------------------------------------
    const out1 = execFileSync(process.execPath, [bin, 'build', '--cwd', dir, '-o', 'tables-subset.mjs'], {
        encoding: 'utf8',
    })
    expect('subset-build-runs', out1.includes('class groups kept'), out1)

    const t1 = (await import(pathToFileURL(join(dir, 'tables-subset.mjs')).href)).default
    const { createCn } = await import('cn/engine')
    const cn1 = createCn(t1)

    // in-corpus classes must merge byte-identically to full tailwind-merge
    const inCorpus = [
        'px-3 px-4', 'px-4 p-2', 'p-2 px-4', 'text-sm text-lg/7', 'text-lg/7 leading-6',
        'bg-primary hover:bg-primary/90', '-mt-2 py-2', 'w-[13px] px-3',
        'border border-input', 'shadow-sm rounded-md', 'data-[state=open]:p-2 data-[state=open]:px-4',
        'md:hover:text-red-500 hover:md:text-sm', 'inline-flex items-center font-medium text-sm',
    ]
    for (const s of inCorpus) {
        expect('subset-parity', cn1(s) === ref(s), `${JSON.stringify(s)} → ${JSON.stringify(cn1(s))} vs ${JSON.stringify(ref(s))}`)
    }
    // a group absent from the corpus passes through unmerged (its classes have
    // no CSS in this project anyway)
    expect('subset-passthrough', cn1('list-disc list-none') === 'list-disc list-none', cn1('list-disc list-none'))

    // ---- safelist brings a group back ------------------------------------------
    execFileSync(process.execPath, [bin, 'build', '--cwd', dir, '-o', 'tables-safe.mjs', '--safelist', 'safelist.txt', '-q'])
    const t2 = (await import(pathToFileURL(join(dir, 'tables-safe.mjs')).href)).default
    const cn2 = createCn(t2)
    expect('safelist', cn2('columns-2 columns-3') === ref('columns-2 columns-3'), cn2('columns-2 columns-3'))

    // ---- config extension flows into emitted tables ----------------------------
    execFileSync(process.execPath, [bin, 'build', '--cwd', dir, '-o', 'tables-ext.mjs', '--config', 'cn.config.mjs', '--full', '-q'])
    const t3 = (await import(pathToFileURL(join(dir, 'tables-ext.mjs')).href)).default
    const cn3 = createCn(t3)
    expect('config-ext', cn3('text-hero text-lg') === 'text-lg', cn3('text-hero text-lg'))
    expect('config-ext-2', cn3('text-lg text-hero') === 'text-hero', cn3('text-lg text-hero'))

    // ---- --full parity spot-check ----------------------------------------------
    execFileSync(process.execPath, [bin, 'build', '--cwd', dir, '-o', 'tables-full.mjs', '--full', '-q'])
    const t4 = (await import(pathToFileURL(join(dir, 'tables-full.mjs')).href)).default
    const cn4 = createCn(t4)
    for (const s of ['p-2 px-4 p-6', 'hover:md:p-2 md:hover:p-4', 'columns-2 columns-3', 'text-lg/7 text-xl']) {
        expect('full-parity', cn4(s) === ref(s), JSON.stringify(s))
    }

    // ---- pre-extracted tokens mode ----------------------------------------------
    writeFileSync(join(dir, 'tokens.txt'), 'p-2 px-4 hover:bg-red-500\n')
    execFileSync(process.execPath, [bin, 'build', '--cwd', dir, '-o', 'tables-tok.mjs', '--tokens', 'tokens.txt', '-q'])
    const t5 = (await import(pathToFileURL(join(dir, 'tables-tok.mjs')).href)).default
    const cn5 = createCn(t5)
    expect('tokens-mode', cn5('p-2 px-4') === ref('p-2 px-4'), cn5('p-2 px-4'))

    // ---- .ts output is emitted with annotations ----------------------------------
    execFileSync(process.execPath, [bin, 'build', '--cwd', dir, '-o', 'tables.ts', '--tokens', 'tokens.txt', '-q'])
    const tsSource = (await import('node:fs')).readFileSync(join(dir, 'tables.ts'), 'utf8')
    expect('ts-output', tsSource.includes('(s: string, o = 0): Int32Array'), 'missing TS annotations')
} finally {
    rmSync(dir, { recursive: true, force: true })
}

console.log(`cli: pass ${pass}  fail ${fail}`)
process.exit(fail > 0 ? 1 : 0)
