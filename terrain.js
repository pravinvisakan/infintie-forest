import {tiny, defs} from './common.js';

// Pull these names into this module's scope for convenience:
const { Vec, Mat, Mat4, Color, Light, Shape, Shader, Material, Texture,
         Scene, Canvas_Widget, Code_Widget, Text_Widget } = tiny;
const { Cube, Subdivision_Sphere, Cylindrical_Tube, Triangle, Windmill, Tetrahedron, Combined_Shape_Shader } = defs;

// Now we have loaded everything in the files tiny-graphics.js, tiny-graphics-widgets.js, and assignment-4-resources.js.
// This yielded "tiny", an object wrapping the stuff in the first two files, and "defs" for wrapping all the rest.

// Imports for our term projects
import {LSystemPlant, LSystemGrammar, ForestPatch} from './l_system.js';
import {rules, genericSymbolMaps} from './grammars_and_maps.js';
import {Height_Map} from './perlin-noise-tests.js'
import {Combined_Shapes_Test} from './custom-shaders.js'
import {colored_shapes_defs} from './colored-shapes.js'
import {Noise_Grid, Noise_Generator} from './perlin-noise.js'

// pull rules, maps, and noise test scenes into this namespace
const { Algae, Binary } = rules;
const { AlgaeMap, BinaryMap } = genericSymbolMaps;
const { cCube } = colored_shapes_defs;



class Terrain extends Scene
{                                             // **Solar_System**:  Your Assignment's Scene.
  constructor()
    {                  // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
      super();
                                                        // At the beginning of our program, load one of each of these shape 
                                                        // definitions onto the GPU.  NOTE:  Only do this ONCE per shape.
                                                        // Don't define blueprints for shapes in display() every frame.

	  // shapes
      this.shapes = { 'box' : new Cube(),
                   'ball_4' : new Subdivision_Sphere( 4 ) }
                 
                   
      // shaders
      const phong_shader = new defs.Phong_Shader  (2);
      const combo_shader = new defs.Combined_Shape_Shader(2);
   
   	  // materials
	  this.materials = { plastic: new Material( phong_shader, 
                                    { ambient: 0.5, diffusivity: 1, specularity: 0, color: Color.of( 1,.5,1,1 ) } ),
                           metal: new Material( phong_shader,
                                    { ambient: 0, diffusivity: 1, specularity: 1, color: Color.of( 1,.5,1,1 ) } ),
              			   combo: new Material( combo_shader,
              			   			{ ambient: 0, diffusivity: 1, specularity: .2 } ),
              			    dirt: new Material( phong_shader,
              			    		{ ambient: .3, diffusivity: 1, specularity: 0, color: Color.of(0.545098, 0.270588, 0.0745098, 1) } )
                       };

      // perlin noise
      this.noiseGen = new Noise_Generator(100);
      this.patch_rows = 4; // number of patches in a row
      this.patch_columns = 5; // number of patches in a column
      this.patch_size = 20; // length/width of a single patch

      // height map level 1
      let scale1 = 2; 
      let var1 = 2;
      let grid1 = new Noise_Grid(this.patch_rows*this.patch_size,this.patch_columns*this.patch_size,var1,this.noiseGen);
      let heights1 = grid1.noise.map(a => a.map(b => (b+1)*scale1));

	  // height map level 2
	  let scale2 = .4;
	  let var2 = 4;
	  let grid2 = new Noise_Grid(this.patch_rows*this.patch_size,this.patch_columns*this.patch_size,var2,this.noiseGen);
	  let heights2 = grid2.noise.map(a => a.map(b => (b+1)*scale2));

	  // height map level 3
	  let scale3 = 0.04;
	  let var3 = 10;
	  let grid3 = new Noise_Grid(this.patch_rows*this.patch_size,this.patch_columns*this.patch_size,var3,this.noiseGen);
	  let heights3 = grid3.noise.map(a => a.map(b => (b+1)*scale3));

	  let final_heights = heights1.map((a,i) => a.map((b,j) => b+heights2[i][j]));
      // array of height map objects
      this.height_maps = []
      let start_row = 0; // for indexing the final_heights array
      let start_col = 0;
      let temp = []
      for (let r=0; r < this.patch_rows; r++) {
      	for (let c=0; c < this.patch_columns; c++) {
      		// subset the heights arrays
      		temp = final_heights.slice(start_row, start_row+this.patch_size) // subset rows
      		let curr_heights = []
      		for (let i=0; i < this.patch_size; i++) {
				curr_heights.push(temp[i].slice(start_col, start_col+this.patch_size)) // subset columns
      		}
      		 
			this.height_maps.push(new Height_Map(this.patch_size, this.patch_size, curr_heights))

			start_col += this.patch_size-1
      	}
      	start_row += this.patch_size-1
      	start_col = 0
      }
  
  	  // frustum culling 
      this.object_container = []; 
      this.generate_test_grid(); 
    }

    generate_test_grid()
    {
      let test_grid_transform = Mat4.identity();

      for (let r=0; r < this.patch_rows; r++)
      {
            test_grid_transform = test_grid_transform.times(Mat4.translation( [1, 0, 0] ));
            for (let c=0; c < this.patch_columns; c++)
            {
              test_grid_transform = test_grid_transform.times(Mat4.translation( [0, 1, 0]));

              // instead of drawing all the objects, store their radius and position
              let object_radius = Math.sqrt(2); // max distance from center of object, in model space
              this.object_container.push({shape  : this.height_maps[r*this.patch_columns + c], 
                                          radius : object_radius, 
                                          model_transform : test_grid_transform.copy()})
            }
            test_grid_transform = test_grid_transform.times(Mat4.translation( [0, -this.patch_columns, 0] ) );
      }


    }


  derive_frustum_points_from_matrix( m, points )
    {
      return points.map( p => Mat4.inverse( m ).times( p.to4(1) ) )
                   .map( p => p.map( x => x/p[3] ).to3() );
    }



  inside_frustum(object, program_state) {

    const view_box_normalized = Vec.cast ( [-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1],
                                           [-1, -1, 1],  [1, -1, 1],  [-1, 1, 1], [1, 1, 1]  );

                                           // The 8 points in order:
                                           // flb, frb, frt, flt, nlb, nrb, nrt, nlt
                                           // However, they change once you put them into frustum_corner_points, like so:
                                           // nlb, nrb, nlt, nrt, flb, frb, flt, frt

    const frustum_corner_points = this.derive_frustum_points_from_matrix( program_state.projection_transform, view_box_normalized);

    // convert object location from model space to camera space
    let camera_inverse = program_state.camera_inverse.copy();
    let model_transform = object.model_transform.copy();
    let modelview_matrix = camera_inverse.post_multiply(model_transform);
    let object_location = modelview_matrix.times(Vec.of(0,0,0,1)); // object centered at origin
    let radius_in_model_space = Vec.of(object.radius, 0, 0);
    let object_radius = modelview_matrix.times(radius_in_model_space);

    let normals = []

    normals.push( this.set3Points_get_n( frustum_corner_points[0], frustum_corner_points[1], frustum_corner_points[2] ) );
    normals.push( this.set3Points_get_n( frustum_corner_points[5], frustum_corner_points[4], frustum_corner_points[7] ) );
    normals.push( this.set3Points_get_n( frustum_corner_points[1], frustum_corner_points[5], frustum_corner_points[3] ) );
    normals.push( this.set3Points_get_n( frustum_corner_points[4], frustum_corner_points[0], frustum_corner_points[6] ) );
    normals.push( this.set3Points_get_n( frustum_corner_points[2], frustum_corner_points[3], frustum_corner_points[6] ) );
    normals.push( this.set3Points_get_n( frustum_corner_points[1], frustum_corner_points[0], frustum_corner_points[5] ) );

    let d_values = []

    d_values.push( this.set3Points_get_d( normals[0], frustum_corner_points[0] ) );
    d_values.push( this.set3Points_get_d( normals[1], frustum_corner_points[5] ) );
    d_values.push( this.set3Points_get_d( normals[2], frustum_corner_points[1] ) );
    d_values.push( this.set3Points_get_d( normals[3], frustum_corner_points[4] ) );
    d_values.push( this.set3Points_get_d( normals[4], frustum_corner_points[2] ) );
    d_values.push( this.set3Points_get_d( normals[5], frustum_corner_points[1] ) );

    let is_inside_frustum = true; // by default we put true.

    // get object's relationship to each plane
    for (let i = 0; i < 6; i++) {
      // tbh, not sure why we have to scale up the object radius.
      // I just know the shapes at the edges don't get drawn if we follow the formula that makes more sense...
      let correction_factor = 300;
      if (normals[i].dot(object_location) + d_values[i] - correction_factor*object_radius[0] > 0) {
        is_inside_frustum = false;
        break;
      }
    }

    return is_inside_frustum
  }

  set3Points_get_n( v1, v2, v3)
  {
    let vectorp_1 = v1.minus(v2);
    let vectorp_2 = v1.minus(v3);

    let normal_vectorp = vectorp_1.cross(vectorp_2); // cross product. this gives the normal vector, or (a, b, c) in the equation.

    return normal_vectorp; // RETURN A VEC3.
  }

    set3Points_get_d( n, p )
  {
    let normal_vectorp = n;

    let d = -1 * normal_vectorp.dot(p); // dot product. gives a SCALAR.
    return d; // RETURN A SCALAR.
  }

  display( context, program_state )
    {                                             
                           // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
      if( !context.scratchpad.controls ) 
        {                       // Add a movement controls panel to the page:
          this.children.push( context.scratchpad.controls = new defs.Movement_Controls() ); 

                    // Define the global camera and projection matrices, which are stored in program_state.  The camera
                    // matrix follows the usual format for transforms, but with opposite values (cameras exist as 
                    // inverted matrices).  The projection matrix follows an unusual format and determines how depth is 
                    // treated when projecting 3D points onto a plane.  The Mat4 functions perspective() and
                    // orthographic() automatically generate valid matrices for one.  The input arguments of
                    // perspective() are field of view, aspect ratio, and distances to the near plane and far plane.          
          program_state.set_camera( Mat4.look_at( Vec.of( 0,10,20 ), Vec.of( 0,0,0 ), Vec.of( 0,1,0 ) ) );
          this.initial_camera_location = program_state.camera_inverse;
          program_state.projection_transform = Mat4.perspective( Math.PI/4, context.width/context.height, 1, 200 );
        }

                                                                      // Find how much time has passed in seconds; we can use
                                                                      // time as an input when calculating new transforms:


      const blue = Color.of( 0,0,.5,1 ), yellow = Color.of( .5,.5,0,1 ), yellow_glass = Color.of( 1, 1, 0, 0.4 );

                                    // Variable model_transform will be a local matrix value that helps us position shapes.
                                    // It starts over as the identity every single frame - coordinate axes at the origin.
      let model_transform = Mat4.identity(); 

   	  const t = this.t = program_state.animation_time/1000;
      const angle = Math.sin( t );
      const light_position = Mat4.rotation( angle, [ 1,0,0 ] ).times( Vec.of( 0,-1,1,0 ) );
      program_state.lights = [ new Light( light_position, Color.of(1,1,1,1), 1000000 ) ];


      // iterate through all objects
      // if the object is in the frustum, draw it
      let objects_drawn = 0;
      let total_objects = this.object_container.length;
      for (let i=0; i < total_objects; i++) {
        let object = this.object_container[i];
        // we check to see if the object is inside frustum. If true, then draw object.
        if (this.inside_frustum(object, program_state)) {
          object.shape.draw(context, program_state, object.model_transform, this.materials.dirt);
          objects_drawn++;
        }
      }

	console.log(objects_drawn)
    }
}
// const Main_Scene = Terrain;
// const Additional_Scenes = [];
// export { Main_Scene, Additional_Scenes, Canvas_Widget, Code_Widget, Text_Widget, defs }
export { Terrain }