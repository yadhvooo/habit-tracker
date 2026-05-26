import urllib.request, re, json
def search(query):
    url = 'https://www.youtube.com/results?search_query=' + urllib.parse.quote(query)
    html = urllib.request.urlopen(url).read().decode()
    matches = re.findall(r'\"videoId\":\"([a-zA-Z0-9_-]{11})\"', html)
    return matches[0] if matches else None

print('cyberpunk:', search('cyberpunk 4k live wallpaper loop 1 hour'))
print('space:', search('space galaxy 4k live wallpaper loop 1 hour'))
print('anime:', search('anime scenery 4k live wallpaper loop 1 hour'))
print('rain:', search('cozy rain 4k live wallpaper loop 1 hour'))
print('nature:', search('beautiful forest nature 4k live wallpaper loop 1 hour'))
