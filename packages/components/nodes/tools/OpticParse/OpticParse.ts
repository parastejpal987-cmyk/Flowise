import { Tool } from '@langchain/core/tools'
import { INode, INodeData, INodeParams } from '../../../src/Interface'
import { getBaseClasses } from '../../../src/utils'

class OpticParse_Tools implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    baseClasses: string[]
    inputs: INodeParams[]

    constructor() {
        this.label = 'OpticParse Web Scraper'
        this.name = 'opticParseTool'
        this.version = 1.0
        this.type = 'OpticParseTool'
        this.icon = 'opticparse.svg'
        this.category = 'Tools'
        this.description = 'Autonomous multimodal vision web scraper that renders modern Single Page Apps, dynamic JS, and bypasses Cloudflare bot protection.'
        this.inputs = [
            {
                label: 'OpticParse API Key',
                name: 'apiKey',
                type: 'password',
                optional: true,
                description: 'Optional API key for higher rate limits. Free trial quota available by default.'
            },
            {
                label: 'Portal URL',
                name: 'portalUrl',
                type: 'string',
                optional: true,
                default: 'https://opticparse-api.onrender.com',
                description: 'OpticParse gateway portal URL.'
            }
        ]
        this.baseClasses = [this.type, ...getBaseClasses(OpticParseSearch)]
    }

    async init(nodeData: INodeData): Promise<any> {
        const apiKey = nodeData.inputs?.apiKey as string
        const portalUrl = nodeData.inputs?.portalUrl as string
        return new OpticParseSearch({ apiKey, portalUrl })
    }
}

class OpticParseSearch extends Tool {
    static lc_name() {
        return 'OpticParseSearch'
    }

    name = 'opticparse_web_scraper'
    description = 'Extract clean Markdown and structured text from any website URL using multimodal vision without brittle CSS selectors. Input should be the target webpage URL, or a URL followed by an extraction query separated by a comma (e.g., "https://news.ycombinator.com, Extract top 5 stories as markdown").'

    protected apiKey?: string
    protected portalUrl?: string

    constructor({ apiKey, portalUrl }: { apiKey?: string; portalUrl?: string }) {
        super()
        this.apiKey = (apiKey || '').trim()
        this.portalUrl = (portalUrl || 'https://opticparse-api.onrender.com').trim().replace(/\/+$/, '')
    }

    protected normalizeUrl(target: string): string {
        let clean = (target || '').trim()
        if (!clean) {
            throw new Error('Target URL cannot be empty.')
        }
        if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
            clean = `https://${clean}`
        }
        return clean
    }

    async _call(input: string): Promise<string> {
        let rawUrl = input
        let query = ''
        if (input.includes(',')) {
            const parts = input.split(',')
            rawUrl = parts[0].trim()
            query = parts.slice(1).join(',').trim()
        }

        const targetUrl = this.normalizeUrl(rawUrl)
        const portal = this.portalUrl || 'https://opticparse-api.onrender.com'

        if (this.apiKey && portal.startsWith('http://')) {
            throw new Error('Insecure HTTP portal URL is not allowed when an API key is configured. Use HTTPS.')
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'User-Agent': 'Flowise-OpticParse-Tool/1.0.0'
        }
        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`
            headers['X-API-Key'] = this.apiKey
        }

        const endpoint = `${portal}/scrape`
        const payload: Record<string, string> = { url: targetUrl }
        if (query) {
            payload['query'] = query
        }

        try {
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                redirect: 'manual'
            })

            if (resp.status >= 300 && resp.status < 400) {
                return 'Error: Gateway returned an unexpected redirect. Request aborted to protect credentials.'
            }

            if (!resp.ok) {
                return `Error from OpticParse: HTTP ${resp.status} - ${await resp.text()}`
            }

            const data: any = await resp.json()
            if (data && typeof data === 'object') {
                return data.markdown || data.extracted_data || JSON.stringify(data, null, 2)
            }
            return String(data)
        } catch (e: any) {
            return `OpticParse execution error: ${e.message || String(e)}`
        }
    }
}

module.exports = { nodeClass: OpticParse_Tools }
