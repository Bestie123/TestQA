const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

async function test() {
  try {
    console.log('Creating MCP server...');
    const server = new McpServer({ name: 'test', version: '1.0.0' });
    
    // Register a simple tool
    server.tool('test-tool', 'Test tool', {}, async () => {
      return { content: [{ type: 'text', text: 'Hello!' }] };
    });
    
    console.log('Creating transport...');
    const transport = new StdioServerTransport();
    
    console.log('Connecting...');
    await server.connect(transport);
    
    console.log('Connected! Waiting for input...');
    
    process.stdin.on('data', (chunk) => {
      console.log('Input received: ' + chunk.toString().substring(0, 100));
    });
    
    setTimeout(() => {
      console.log('Timeout reached, exiting...');
      process.exit(0);
    }, 10000);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

test();
