"""
Generate a sample MCQ Excel file for testing the portal.
Run: python generate_sample_excel.py
"""
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "MCQs"

# Header
headers = ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer']
header_fill = PatternFill("solid", fgColor="1A56DB")
header_font = Font(bold=True, color="FFFFFF", size=11)

for col, header in enumerate(headers, 1):
    cell = ws.cell(row=1, column=col, value=header)
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(horizontal='center')

# Sample 25 MCQs
questions = [
    ("What does HTML stand for?", "HyperText Markup Language", "HighText Machine Language", "HyperText and links Markup Language", "None of the above", "a"),
    ("Which language is used for styling web pages?", "HTML", "CSS", "JavaScript", "Python", "b"),
    ("What does CSS stand for?", "Computer Style Sheets", "Creative Style Sheets", "Cascading Style Sheets", "Colorful Style Sheets", "c"),
    ("Which HTML tag is used for the largest heading?", "<h6>", "<heading>", "<h1>", "<head>", "c"),
    ("What is the correct HTML element for inserting a line break?", "<br>", "<lb>", "<break>", "<newline>", "a"),
    ("Which symbol is used for comments in Python?", "//", "/*", "#", "--", "c"),
    ("What does SQL stand for?", "Structured Query Language", "Simple Query Language", "Standard Question Language", "Structured Question Language", "a"),
    ("Which data type stores decimal numbers in Python?", "int", "float", "str", "bool", "b"),
    ("What is a primary key in a database?", "A key for locking the database", "A unique identifier for each record", "The first column", "An index column", "b"),
    ("Which HTTP method is used to send data to a server?", "GET", "DELETE", "POST", "PUT", "c"),
    ("What does API stand for?", "Application Programming Integration", "Application Protocol Interface", "Application Programming Interface", "Automated Program Interface", "c"),
    ("Which of the following is NOT a JavaScript framework?", "React", "Angular", "Vue", "Django", "d"),
    ("What is a REST API?", "A type of database", "A protocol for file transfer", "An architectural style for APIs over HTTP", "A JavaScript framework", "c"),
    ("What does OOP stand for?", "Object Oriented Programming", "Open Oriented Protocol", "Object Output Process", "None of the above", "a"),
    ("Which Python keyword is used to create a function?", "function", "define", "def", "func", "c"),
    ("What is Git used for?", "Database management", "Version control", "Web development", "API testing", "b"),
    ("Which tag is used to create a hyperlink in HTML?", "<link>", "<a>", "<href>", "<url>", "b"),
    ("What is the time complexity of binary search?", "O(n)", "O(n²)", "O(log n)", "O(1)", "c"),
    ("Which of these is a NoSQL database?", "MySQL", "PostgreSQL", "MongoDB", "SQLite", "c"),
    ("What does JSON stand for?", "JavaScript Object Numbers", "JavaScript Object Notation", "Java Source Object Network", "JavaScript Output Notation", "b"),
    ("Which command is used to install Python packages?", "npm install", "pip install", "apt install", "brew install", "b"),
    ("What is a virtual environment in Python?", "A cloud server", "An isolated Python environment", "A Docker container", "A virtual machine", "b"),
    ("Which HTTP status code means 'Not Found'?", "200", "401", "500", "404", "d"),
    ("What is the purpose of an index in a database?", "To encrypt data", "To backup data", "To speed up data retrieval", "To delete data", "c"),
    ("Which of the following is a Python web framework?", "React", "Angular", "FastAPI", "Vue", "c"),
]

for row, (q, a, b, c, d, ans) in enumerate(questions, 2):
    ws.cell(row=row, column=1, value=q)
    ws.cell(row=row, column=2, value=a)
    ws.cell(row=row, column=3, value=b)
    ws.cell(row=row, column=4, value=c)
    ws.cell(row=row, column=5, value=d)
    ws.cell(row=row, column=6, value=ans)

# Column widths
ws.column_dimensions['A'].width = 60
for col in ['B','C','D','E']:
    ws.column_dimensions[col].width = 35
ws.column_dimensions['F'].width = 18

filename = "sample_mcqs.xlsx"
wb.save(filename)
print(f"✅ Sample Excel file created: {filename}")
print(f"   Upload this file on the Admin > Upload MCQs page.")
