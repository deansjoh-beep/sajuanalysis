import React from 'react';
import SimpleMDE from 'react-simplemde-editor';
import 'easymde/dist/easymde.min.css';

type LazySimpleMDEProps = React.ComponentProps<typeof SimpleMDE>;

const LazySimpleMDE: React.FC<LazySimpleMDEProps> = (props) => {
  return <SimpleMDE {...props} />;
};

export default LazySimpleMDE;
