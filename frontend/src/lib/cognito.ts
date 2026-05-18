import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID ?? '',
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID ?? '',
};

function getPool(): CognitoUserPool {
  return new CognitoUserPool(poolData);
}

export function signIn(email: string, password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const pool = getPool();
    const user = new CognitoUser({ Username: email, Pool: pool });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });

    user.authenticateUser(authDetails, {
      onSuccess(session) {
        const accessToken = session.getAccessToken().getJwtToken();
        localStorage.setItem('token', accessToken);
        resolve(accessToken);
      },
      onFailure(err) {
        reject(err);
      },
    });
  });
}

export function signUp(email: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const pool = getPool();
    const attributeList = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
    ];

    pool.signUp(email, password, attributeList, [], (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

export function confirmSignUp(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const pool = getPool();
    const user = new CognitoUser({ Username: email, Pool: pool });

    user.confirmRegistration(code, true, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

export function signOut(): void {
  const pool = getPool();
  const user = pool.getCurrentUser();
  if (user) {
    user.signOut();
  }
  localStorage.removeItem('token');
  localStorage.removeItem('tenantId');
}

export function getAccessToken(): string | null {
  return localStorage.getItem('token');
}

export function getCurrentUser(): CognitoUser | null {
  return getPool().getCurrentUser();
}
