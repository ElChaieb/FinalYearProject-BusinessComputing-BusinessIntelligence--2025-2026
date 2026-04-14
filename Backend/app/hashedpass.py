##USE THIS FILE TO GENERATE HASHED PASSWORDS FOR ADMIN ACCOUNT.



from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
print(pwd_context.hash("passWord0@"))