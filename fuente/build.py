import base64,sys
d='/tmp/claude-0/viaticos/'
css=open(d+'src/app.css').read(); js=open(d+'src/app.js').read(); body=open(d+'src/body.html').read()
logo='data:image/png;base64,'+base64.b64encode(open(d+'icons/logo-full.png','rb').read()).decode()
pre='<script>const LOGO="%s";</script>'%logo
head='<title>Viáticos Sistronic</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>\n'+css+'\n</style>\n'
inner=head+body+pre+'\n<script>\n'+js+'\n</script>\n'
full='''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#082759">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<title>Viáticos Sistronic</title>
<style>
'''+css+'''
:root{padding-top:env(safe-area-inset-top,0px)}
[hidden]{display:none!important}
</style>
</head>
<body>
'''+body+pre+'\n<script>\n'+js+'\n</script>\n</body>\n</html>\n'
open(d+'index.html','w').write(full)
open(d+'artifact.html','w').write(inner)
print(len(full))
