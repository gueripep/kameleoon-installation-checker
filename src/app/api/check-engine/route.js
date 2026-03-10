import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

function normalizeUrl(url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return `https://${url}`;
    }
    return url;
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { urls = [], credentials = {} } = body;

        if (!Array.isArray(urls) || urls.length === 0) {
            return NextResponse.json({ error: 'Please provide an array of URLs' }, { status: 400 });
        }

        const browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const results = [];

        for (let rawUrl of urls) {
            const targetUrl = normalizeUrl(rawUrl);
            let engineFound = false;
            let kameleoonFound = false;

            try {
                const page = await browser.newPage();
                await page.setViewport({ width: 1920, height: 1080 });
                await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

                if (credentials.username || credentials.password) {
                    await page.authenticate({
                        username: credentials.username || '',
                        password: credentials.password || ''
                    });
                }

                page.on('request', request => {
                    const reqUrl = request.url();
                    if (reqUrl.includes('kameleoon.js')) {
                        kameleoonFound = true;
                    } else if (reqUrl.includes('engine.js')) {
                        engineFound = true;
                    }
                });

                await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                await new Promise(resolve => setTimeout(resolve, 2000));
                await page.close();

            } catch (error) {
                results.push({
                    url: targetUrl,
                    result: 'ERROR',
                    details: error.message.substring(0, 100)
                });
                continue;
            }

            let state = 'NONE';
            if (kameleoonFound && engineFound) {
                state = 'BOTH (Unexpected)';
            } else if (kameleoonFound) {
                state = 'kameleoon.js';
            } else if (engineFound) {
                state = 'engine.js';
            }

            results.push({
                url: targetUrl,
                result: state
            });
        }

        await browser.close();
        return NextResponse.json({ results });

    } catch (error) {
        console.error('Engine checker API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
