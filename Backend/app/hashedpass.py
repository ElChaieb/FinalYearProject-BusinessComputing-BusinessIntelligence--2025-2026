##USE THIS FILE TO GENERATE HASHED PASSWORDS FOR ADMIN ACCOUNT.

#Administrateur BI


from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
print(pwd_context.hash("Pfe2625@"))


## insert into users (name, email, hashed_password, role) values ('Admin', 'biapppfe26@gmail.com', '$2b$12$aPnlKu86VvAp6gEeZU9gBOuVwPMcbcUteHrgMrkadQNsDajLLnuzi', 'Administrateur BI');