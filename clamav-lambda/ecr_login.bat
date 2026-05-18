@echo off
rem AWS ????? ????? ????? (?? ?? ???? ???)
<<<<<<< HEAD
rem set AWS_ACCESS_KEY_ID=???_????
rem set AWS_SECRET_ACCESS_KEY=???_????
=======
rem set AWS_ACCESS_KEY_ID=
rem set AWS_SECRET_ACCESS_KEY=
>>>>>>> origin/JC
set AWS_DEFAULT_REGION=ap-northeast-2
aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin 264787847773.dkr.ecr.ap-northeast-2.amazonaws.com
