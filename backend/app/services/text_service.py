from pypdf import PdfReader

# Extract text from PDF files
def extract_text(file_path: str):

    if file_path.endswith(".pdf"):
        reader = PdfReader(file_path)

        text = ""
        for page in reader.pages:
            text += page.extract_text()

        return text

    # fallback for txt files
    elif file_path.endswith(".txt"):
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()

    return ""
