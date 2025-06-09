import os
import sys
import httpx
from colorama import Fore, init

init(autoreset=True)

# Define color constants for better readability
FR = Fore.RED
FG = Fore.GREEN
FY = Fore.YELLOW
FW = Fore.WHITE
FRE = Fore.RESET

# List of proxy URLs
PROXY_URLS = [
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/refs/heads/master/http.txt',
    'https://raw.githubusercontent.com/officialputuid/KangProxy/refs/heads/KangProxy/https/https.txt',
    'https://raw.githubusercontent.com/officialputuid/KangProxy/refs/heads/KangProxy/http/http.txt',
    'https://raw.githubusercontent.com/prxchk/proxy-list/main/http.txt',
    'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
    'https://raw.githubusercontent.com/proxylist-to/proxy-list/main/http.txt',
    'https://raw.githubusercontent.com/yuceltoluyag/GoodProxy/main/raw.txt',
    'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
    'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/https.txt',
    'https://raw.githubusercontent.com/mmpx12/proxy-list/master/https.txt',
    'https://raw.githubusercontent.com/Anonym0usWork1221/Free-Proxies/main/proxy_files/http_proxies.txt',
    'https://raw.githubusercontent.com/opsxcq/proxy-list/master/list.txt',
    'https://raw.githubusercontent.com/Anonym0usWork1221/Free-Proxies/main/proxy_files/https_proxies.txt',
    'https://api.openproxylist.xyz/http.txt',
    'https://api.proxyscrape.com/v2/?request=displayproxies',
    'https://api.proxyscrape.com/?request=displayproxies&proxytype=http',
    'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all',
    'https://www.proxydocker.com/en/proxylist/download?email=noshare&country=all&city=all&port=all&type=all&anonymity=all&state=all&need=all',
    'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-http.txt',
    'https://raw.githubusercontent.com/mertguvencli/http-proxy-list/main/proxy-list/data.txt',
    'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt',
    'https://raw.githubusercontent.com/sunny9577/proxy-list/master/proxies.txt',
    'https://raw.githubusercontent.com/hookzof/socks5_list/master/http.txt',
    'https://raw.githubusercontent.com/rdavydov/proxy-list/main/proxies/http.txt',
    'https://raw.githubusercontent.com/zevtyardt/proxy-list/main/http.txt',
    'https://raw.githubusercontent.com/officialputuid/KangProxy/master/http/http.txt',
    'https://raw.githubusercontent.com/fate0/proxylist/master/proxy.list', # This one might require parsing if not pure IP:Port
    'https://raw.githubusercontent.com/hendrikbgr/Free-Proxy-List/master/http.txt',
    'https://raw.githubusercontent.com/saisuiu/free-proxy-list/main/http.txt',
    'https://raw.githubusercontent.com/RXROD/proxy-list/main/online.txt',
    'https://www.proxy-list.download/api/v1/get?type=http',
    'https://www.proxyscan.io/download?type=http',
    'https://openproxy.space/list/http', # May require parsing
    'https://proxylist.geonode.com/api/proxies/anon', # API, will require parsing
    'https://proxysearcher.sourceforge.net/Proxy%20List.php?type=http', # HTML page, will require parsing
    'http://proxydb.net/?offset=0', # HTML page, will require parsing
    'https://www.freeproxylists.com/load_http.txt',
    'https://raw.githubusercontent.com/UserR3X/Proxy-List/main/http.txt',
    'https://raw.githubusercontent.com/zloi-user/hideip.me/main/http.txt',
    'https://raw.githubusercontent.com/manuprogramm/proxy-list/main/https-proxies.txt',
]

if __name__ == "__main__":
    proxy_file = "proxy.txt"

    try:
        if os.path.isfile(proxy_file):
            os.system('cls' if os.name == 'nt' else 'clear')
            os.remove(proxy_file)
            print(f"{FR}File {proxy_file} already exists!\n{FY}Starting download of a new {proxy_file}!\n")
            with open(proxy_file, 'a') as data:
                for proxy_url in PROXY_URLS:
                    try:
                        response = httpx.get(proxy_url, timeout=10) # Added timeout for robustness
                        response.raise_for_status() # Raise an exception for bad status codes
                        data.write(response.text)
                        print(f" -| Fetching {FG}{proxy_url}{FRE}")
                    except httpx.RequestError as e:
                        print(f" -| {FR}Failed to fetch {proxy_url}: {e}{FRE}")
        else:
            os.system('cls' if os.name == 'nt' else 'clear')
            with open(proxy_file, 'a') as data:
                for proxy_url in PROXY_URLS:
                    try:
                        response = httpx.get(proxy_url, timeout=10)
                        response.raise_for_status()
                        data.write(response.text)
                        print(f" -| Fetching {FG}{proxy_url}{FRE}")
                    except httpx.RequestError as e:
                        print(f" -| {FR}Failed to fetch {proxy_url}: {e}{FRE}")

        with open(proxy_file, 'r') as count:
            total_proxies = sum(1 for line in count if line.strip()) # Count non-empty lines
        print(f"\n{FW}( {FY}{total_proxies}{FW} ) {FG}Proxies successfully downloaded.{FRE}")

    except Exception as e: # Catch a broader exception for unexpected errors
        print(f"{FR}An error occurred: {e}{FRE}")
        sys.exit(1)

