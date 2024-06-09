addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
  });

  async function handleRequest(request) {
    const url = new URL(request.url);

    // Check if the path is /blog
    if (url.pathname === '/blog') {
      // Fetch the index.json file from your CDN
      const response = await fetch('https://cdn.jonasjones.dev/blog/index.json');
      const data = await response.json();

      // Process the JSON data to create the RSS feed
      const rssFeed = createRSSFeed(data);

      // Return the RSS feed as the response
      return new Response(rssFeed, {
        headers: { 'Content-Type': 'application/rss+xml' },
      });
    } else {
      // Handle other routes or return a 404 response
      return new Response('Not Found', { status: 404 });
    }
  }

  function createRSSFeed(data) {
    const DOMAIN = 'https://blog.jonasjones.dev';
    const items = data.slice(-50).reverse().map(item => `
      <item>
        <title><![CDATA[${item.title}]]></title>
        <link>${DOMAIN}/#/post/${formatDateForLink(item.date)}/${item.id}</link>
        <guid isPermaLink="true">${DOMAIN}/#/post/${formatDateForLink(item.date)}/${item.id}</guid>
        <author><![CDATA[${item.author}]]></author>
        <pubDate>${new Date(item.date).toUTCString()}</pubDate>
        <description><![CDATA[${item.description}]]></description>
      </item>
    `).join('');

    return `<?xml version="1.0" encoding="UTF-8" ?>
  <rss version="2.0">
    <channel>
      <title>Your Blog Title</title>
      <link>${DOMAIN}</link>
      <description>Your blog description</description>
      <language>en-us</language>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
      <generator>Cloudflare Worker</generator>
      ${items}
    </channel>
  </rss>`;
  }

  function formatDateForLink(dateString) {
    const date = new Date(dateString);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  }
