import sys
p='src/content/books/more.ts'; s=open(p).read()
add=open(sys.argv[1]).read().rstrip()+'\n'
s=s.replace("]\n\nexport const moreBooks", add+"]\n\nexport const moreBooks")
open(p,'w').write(s)
