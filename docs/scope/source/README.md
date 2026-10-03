# Regenerating the scope document

The Word file and its Markdown twin are generated from `build.js`, so edit the content there.

```bash
cd docs/scope/source
node build.js ../CaviNet_Scope_Document_v2.docx air_university_logo.png   # needs: npm install docx
python3 docx2md.py ../CaviNet_Scope_Document_v2.docx ../CaviNet_Scope_Document_v2.md   # needs: pip install lxml
```

`CaviNet_Scope_Document_v2.md` is the copy Claude Code reads (the phase prompts point to it).
When opening the .docx in Word, accept "update fields" to fill in the table of contents.
