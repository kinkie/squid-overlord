const Http = require('http');
//const Path = require('path');
const Config = require('./Config.js');
const Command = require('./Command.js');
const ServerState = require('./ServerState.js');

process.on("unhandledRejection", function (reason /*, promise */) {
    console.log("Quitting on a rejected promise:", reason);
    throw reason;
});

async function StartSquid()
{
    const options =
        " -f " + Config.squidConfig() + // our configuration
        " -C "; // prefer "raw" errors
    const shell = Config.exe() + options + "> var/logs/squid.out 2>&1";
    let command = new Command(shell);
    await command.run();
    if (!await ServerState.StartsListening(Config.defaultSquidListeningAddress()))
        throw new Error("Squid failed to start");
}

async function StopSquid()
{
    const pidFilename = Config.pidFilename();
    const shell = "kill -INT `cat " + pidFilename + "`";
    let command = new Command(shell);
    await command.run();
    if (!await ServerState.RemovesPid(pidFilename))
        throw new Error("Squid failed to stop");
}


async function HandleRequest(request, response)
{
    if (request.url === '/') {
        // TODO: Send actions menu.
        return sendOk(response);
    }

    if (request.url === '/start') {
        await StartSquid();
        return sendOk(response);
    }

    if (request.url === '/stop') {
        await StopSquid();
        return sendOk(response);
    }

    response.writeHead(404, { 'Content-Type': 'text/plain' });
    return response.end("Unsupported request");
}

async function RequestListener(request, response)
{
    try {
        return await HandleRequest(request, response);
    } catch (error) {
        console.log("failure while handling request for ", request.url);
        console.log("error: ", error);
        response.writeHead(555, 'External Server Error', { 'Content-Type': 'text/plain' });
        return response.end(`${error}`); // safer than toString()?
    }
}

function sendOk(response)
{
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    return response.end('OK.');
}

process.chdir(Config.installationRoot());

const server = Http.createServer(RequestListener);

server.listen(13128);
