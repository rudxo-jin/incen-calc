import openpyxl

try:
    wb = openpyxl.load_workbook('근로소득_간이세액표(조견표).xlsx')
    sheet = wb.active
    
    # Iterate from row 650 to max row
    for row in sheet.iter_rows(min_row=650):
        values = []
        for cell in row:
            if cell.value:
                values.append(str(cell.value))
        if values:
            print(f"Row {row[0].row}: {' '.join(values)}")
            
except Exception as e:
    print(f"Error: {e}")
