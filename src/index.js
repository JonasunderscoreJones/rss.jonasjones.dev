addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event.env));
});

const headersCORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-Custom-Auth-Key',
};

  async function handleRequest(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      // Handle CORS preflight request
      return new Response(null, {
        status: 204,
        headers: headersCORS
      });
    }

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

    } else if (url.pathname === '/blog/new_post') {
      if (request.method === 'POST') {

        if (!hasValidHeader(request)) {
          return new Response('Unauthorized', { status: 401, headers: headersCORS});
        }

        try {

          const formData = await request.formData();
          const formFields = {};
          for (const [key, value] of formData.entries()) {
            formFields[key] = value;
          }

          const fileName = formFields['id'] + '.md';
          const posttitle = formFields['title'];
          const postauthor = formFields['author'];
          const postdate = formFields['date'];
          const postdescription = formFields['description'];

          const year = postdate.split('-')[0];
          const month = postdate.split('-')[1];
          const day = postdate.split('-')[2].split(' ')[0];

          const fileContent = new TextEncoder().encode(
            `[title]: ${posttitle}
[author]: ${postauthor}
[date]: ${postdate}
[description]: ${postdescription}
` + formFields['content']);

          const response = await fetch('https://cdn.jonasjones.dev/blog/index.json');
          const data = await response.json();

          // add new json object to data
          const postObj = {
            id: formFields['id'],
            date: formFields['date'],
            title: formFields['title'],
            author: formFields['author'],
            description: formFields['description']
          };

          // Check if the object with the given id already exists
          const index = data.findIndex(item => item.id === postObj.id);

          if (index !== -1) {
            // If it exists, update the existing object
            data[index] = postObj;
          } else {
            // If it does not exist, add the new JSON object to the list
            data.push(postObj);
          }


          // Access the R2 bucket using the binding
          try {
            await CDN_BUCKET.put(`blog/posts/${year}/${month}/${day}/${fileName}`, fileContent, {
              httpMetadata: {
                contentType: "text/markdown"
              },
              headers: headersCORS
            });
            await CDN_BUCKET.put(`blog/index.json`, JSON.stringify(data), {
              httpMetadata: {
                contentType: "application/json"
              }
            });

            // If the put operation succeeds (no error is thrown), return a success response
            return new Response(`Post Successfully uploaded`, { status: 200 });
          } catch (error) {
            // If an error occurs during the put operation, return a failure response
            return new Response(`Failed to upload Post: ${error.message}`, { status: 500 });
          }


        } catch (e) {
          return new Response(e, { status: 400 });
        }

      } else {
        return new Response('Method Not Allowed', { status: 405 });
      }

    } else if (url.pathname === "/blog/delete_post") {
      if (request.method === 'DELETE') {

        if (!hasValidHeader(request)) {
          return new Response('Unauthorized', { status: 401 });
        }

        try {

          const formData = await request.formData();
          const formFields = {};
          for (const [key, value] of formData.entries()) {
            formFields[key] = value;
          }

          const fileName = formFields['id'] + '.md';

          const response = await fetch('https://cdn.jonasjones.dev/blog/index.json');

          const data = await response.json();

          // Check if the object with the given id already exists
          const index = data.findIndex(item => item.id === formFields['id']);

          if (index !== -1) {
            // If it exists, delete the existing object
            data.splice(index, 1);
          }

          // delete the file from the bucket
          CDN_BUCKET.delete(`blog/posts/${fileName}`);

          // update the index.json file
          await CDN_BUCKET.put(`blog/index.json`, JSON.stringify(data), {
            httpMetadata: {
              contentType: "application/json"
            }
          });

          return new Response(`Post Successfully deleted`, { status: 200 });
        } catch (e) {
          return new Response('Failed to delete Post', { status: 500 });
        }
      }
      return new Response('Method Not Allowed', { status: 405 });
    } else {
      // Handle other routes or return a 404 response
      return new Response('Not Found', { status: 404 });
    }
  };

  const hasValidHeader = (request) => {
    return request.headers.get('X-Custom-Auth-Key') === AUTH_KEY_SECRET;
  };

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
