##USE THIS FILE TO GENERATE HASHED PASSWORDS FOR ADMIN ACCOUNT.

#Administrateur BI


from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
hashed = pwd_context.hash("Pfe2625@")
print('Hash:', hashed)
print('Verify correct:', pwd_context.verify('Pfe2625@', hashed))
print('Verify wrong:  ', pwd_context.verify('wrongpassword', hashed))


## insert into users (name, email, hashed_password, role) values ('Admin', 'biapppfe26@gmail.com', '$2b$12$AlIy0DG31Gwv19isqSqClOklXQo1Kl8TwlfxUTuxgPGtShG4QlkkK', 'Administrateur BI');