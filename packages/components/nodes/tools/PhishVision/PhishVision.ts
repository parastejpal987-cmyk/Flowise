import { Tool } from '@langchain/core/tools'
import { INode, INodeData, INodeParams } from '../../../src/Interface'
import { getBaseClasses } from '../../../src/utils'

class PhishVision_Tools implements INode {
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
        this.label = 'PhishVision Threat Shield'
        this.name = 'phishVisionTool'
        this.version = 1.0
        this.type = 'PhishVisionTool'
        this.icon = 'phishvision.svg'
        this.category = 'Tools'
        this.description = 'Real-time cybersecurity scanner detecting zero-day phishing, credential harvesting, brand impersonation, and cryptocurrency wallet drainers.'
        this.inputs = [
            {
                label: 'PhishVision API Key',
                name: 'apiKey',
                type: 'password',
                optional: true,
                description: 'Optional API key for higher throughput. Free trial quota included.'
            },
            {
                label: 'Portal URL',
                name: 'portalUrl',
                type: 'string',
                optional: true,
                default: 'https://opticparse-api.onrender.com',
                description: 'PhishVision gateway portal URL.'
            }
        ]
        this.baseClasses = [this.type, ...getBaseClasses(PhishVisionScan)]
    }

    async init(nodeData: INodeData): Promise<any> {
        const apiKey = nodeData.inputs?.apiKey as string
        const portalUrl = nodeData.inputs?.portalUrl as string
        return new PhishVisionScan({ apiKey, portalUrl })
    }
}

class PhishVisionScan extends Tool {
    static lc_name() {
        return 'PhishVisionScan'
    }

    name = 'phishvision_threat_shield'
    description = 'Audit any webpage URL or bare domain for zero-day phishing, credential theft, brand spoofing, and malicious crypto wallet drainers. Input should be the target URL or domain to inspect (e.g., "https://suspicious-site.xyz" or "example.com").'

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
            throw new Error('Target domain or URL cannot be empty.')
        }
        if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
            clean = `https://${clean}`
        }
        return clean
    }

    async _call(input: string): Promise<string> {
        const targetUrl = this.normalizeUrl(input)
        const portal = this.portalUrl || 'https://opticparse-api.onrender.com'

        if (this.apiKey && portal.startsWith('http://')) {
            throw new Error('Insecure HTTP portal URL is not allowed when an API key is configured. Use HTTPS.')
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'User-Agent': 'Flowise-PhishVision-Tool/1.0.0'
        }
        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`
            headers['X-API-Key'] = this.apiKey
        }

        const endpoint = `${portal}/phishvision/scan`

        try {
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({ url: targetUrl }),
                redirect: 'manual'
            })

            if (resp.status >= 300 && resp.status < 400) {
                return 'Error: Gateway returned an unexpected redirect. Request aborted to protect credentials.'
            }

            if (!resp.ok) {
                return `Error from PhishVision: HTTP ${resp.status} - ${await resp.text()}`
            }

            const data: any = await resp.json()
            return typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data)
        } catch (e: any) {
            return `PhishVision execution error: ${e.message || String(e)}`
        }
    }
}

module.exports = { nodeClass: PhishVision_Tools }
