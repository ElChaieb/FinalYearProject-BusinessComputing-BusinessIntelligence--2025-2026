from etl.pipeline.file_processor import process_file
report = process_file("etl/raw/CRM CHEDIA-AKOUDA.xlsx")
print(report)