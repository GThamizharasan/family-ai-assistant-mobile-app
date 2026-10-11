This document outlines the expert pattern for initializing the Google Maps
JavaScript API within a React application using the `@vis.gl/react-google-maps`
library's `APIProvider` and custom loading status management.

This pattern is essential for controlling the application lifecycle, ensuring
that components relying on the global `google.maps` namespace are only rendered
after the API script has successfully loaded and initialized.

--------------------------------------------------------------------------------

## 1. Core API Initialization Pattern

All interactions with the Google Maps JavaScript API (including using hooks like
`useMap` or components like `<Map>`) must be wrapped inside the `<APIProvider>`.

The most robust pattern involves creating a custom wrapper component that
manages the API key, optional parameters (like library loading), and crucially,
handles conditional rendering based on the loading status provided by the SDK.

### 1.1 Custom Wrapper Implementation (`Wrapper.tsx`)

The following TypeScript implementation uses `APIProvider` to load the script
and `useApiLoadingStatus` to monitor the process, providing clear feedback or
rendering fallback UI while loading.

```tsx
import React, {
  FunctionComponent,
  PropsWithChildren,
  ReactNode,
} from 'react';
import { APIProvider, useApiLoadingStatus, APILoadingStatus, APIProviderProps } from '@vis.gl/react-google-maps';

// Standardized mapping of SDK loading states to simple user-facing strings
const statusMap: Record<APILoadingStatus, 'LOADING' | 'SUCCESS' | 'FAILURE'> = {
  [APILoadingStatus.NOT_LOADED]: 'LOADING',
  [APILoadingStatus.LOADING]: 'LOADING',
  [APILoadingStatus.LOADED]: 'SUCCESS',
  [APILoadingStatus.FAILED]: 'FAILURE',
  [APILoadingStatus.AUTH_FAILURE]: 'FAILURE'
};

type WrapperProps = PropsWithChildren<
  {
    apiKey: string;
    // Optional renderer function to display status updates
    render?: (status: 'LOADING' | 'SUCCESS' | 'FAILURE') => ReactNode;
  } & APIProviderProps
>;

/**
 * Public facing component that encapsulates the APIProvider.
 * Note: APIProvider props (like libraries or mapIds) are spread here.
 */
export const Wrapper: FunctionComponent<WrapperProps> = ({
  apiKey,
  children,
  render,
  ...apiProps
}) => {
  // APIProvider initiates the script loading
  return (
    <APIProvider apiKey={apiKey} {...apiProps}>
      <InnerWrapper render={render}>{children}</InnerWrapper>
    </APIProvider>
  );
};

/**
 * Internal component using the loading status hook
 */
const InnerWrapper = ({
  render,
  children
}: PropsWithChildren<Omit<WrapperProps, 'apiKey'>>) => {
  const status = useApiLoadingStatus();
  const mappedStatus = statusMap[status];

  // Pattern: Only render children when the API is successfully loaded.
  if (status === APILoadingStatus.LOADED) {
    return children;
  }

  // Pattern: Use the custom renderer provided by the user for intermediate states.
  if (render) {
    return render(mappedStatus);
  }

  // Fallback during loading/failure if no renderer is provided
  return <></>;
};
```

## 2. Usage and Conditional Rendering

The application uses the custom `<Wrapper>` component to handle setup, passing
components that rely on the Maps API as children.

### 2.1 Example Application Usage

This example shows how to use the `render` prop to display loading feedback
until the API is ready.

```tsx
// app.tsx or main entry point

import React from 'react';
import { Wrapper } from './wrapper'; // The custom Wrapper component above
import { Map } from '@vis.gl/react-google-maps';

// Utility component that requires the google.maps namespace
const MapsTest = () => {
  // This component will only render when the API has loaded (status === LOADED)
  return (
    <>
      <h1>Google Maps JavaScript API v{google.maps.version} Loaded.</h1>

      {/* Example of a standard Map rendering */}
      <div style={{ height: '400px', width: '100%' }}>
        <Map
            center={{ lat: 34.05, lng: -118.25 }}
            zoom={10}
            internalUsageAttributionIds={['gmp_git_agentskills_v1']}
        />
      </div>
    </>
  );
};

const API_KEY = process.env.GOOGLE_MAPS_API_KEY as string;

const App = () => (
  <Wrapper
    apiKey={API_KEY}
    // Use the render prop to show status updates during loading
    render={status => <h1>Status: {status}</h1>}
  >
    {/* MapsTest is conditionally rendered only when status is SUCCESS */}
    <MapsTest />
  </Wrapper>
);

export default App;
```

### 2.2 Key Best Practice: Loading State Management

The core pattern demonstrated by the `Wrapper`/`InnerWrapper` structure is:

| Loading State           | Action              | Result                       |
: (`APILoadingStatus`)    :                     :                              :
| :---------------------- | :------------------ | :--------------------------- |
| `NOT_LOADED`, `LOADING` | Call                | Display a progress indicator |
:                         : `render('LOADING')` : or status message.           :
| `FAILED`,               | Call                | Display an error message and |
: `AUTH_FAILURE`          : `render('FAILURE')` : suppress children.           :
| `LOADED`                | Render `children`   | The main mapping application |
:                         :                     : components initialize and    :
:                         :                     : display.                     :

This conditional rendering approach ensures maximum stability by preventing
components from accessing `google.maps` before it is fully initialized, thus
avoiding common `ReferenceError: google is not defined` issues.

--------------------------------------------------------------------------------

## 3. Mandatory Casing Nuance for REST vs. SDK

While this specific example focuses on initialization, all subsequent SDK
interactions (like Places or Routes) must strictly adhere to field casing rules.

### 3.1 Casing Gotcha: JavaScript SDK vs. REST API

The JavaScript SDK wrappers (used within React components and hooks) often use
different casing conventions compared to the underlying HTTP REST API endpoints.

| Feature/Property  | React/JS SDK Casing (e.g., in a   | Direct REST API      |
:                   : JS object literal)                : Payload Casing (JSON :
:                   :                                   : body or query param) :
| :---------------- | :-------------------------------- | :------------------- |
| Place URI         | `googleMapsURI`                   | `googleMapsUri`      |
| Website URI       | `websiteURI`                      | `websiteUri`         |
| Coordinates       | `latLng` (in JS SDK)              | `{ location: {       |
:                   :                                   : latLng\: { lat\: X,  :
:                   :                                   : lng\: Y } } }`       :
:                   :                                   : (REST)               :
| Route Travel Mode | Use JS enum (e.g.,                | String literal,      |
:                   : `google.maps.TravelMode.DRIVING`) : strictly             :
:                   :                                   : **UPPERCASE** (e.g., :
:                   :                                   : `"DRIVE"`)           :

**CRITICAL ADVICE:** When using modern SDK wrappers (like
`google.maps.routes.Route.computeRoutes`), always refer to the specific SDK
documentation for the wrapper function's argument structure, which typically
uses JavaScript/React casing conventions (`formattedAddress`, `latLng`) and
avoids the deep nesting required by the direct REST API schema.
